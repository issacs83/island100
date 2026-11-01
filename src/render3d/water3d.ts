import {BufferAttribute, Color, Mesh, PlaneGeometry, ShaderMaterial, type BufferGeometry} from 'three';
import {shore} from '../terrain';
import {UNIT} from './space';
import {DAY, bend} from './look';

// Sea surface from the west edge of the view to just past the shore (scene units).
export const WATER_BOUNDS = {x0: -60, x1: 18, z0: -30, z1: 90};

// Plane with aDist = distance offshore in scene units (negative on land, where the shader discards).
export function buildWaterGeometry(): BufferGeometry {
  const w = WATER_BOUNDS.x1 - WATER_BOUNDS.x0, d = WATER_BOUNDS.z1 - WATER_BOUNDS.z0;
  const geometry = new PlaneGeometry(w, d, w * 2, d);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(WATER_BOUNDS.x0 + w / 2, 0, WATER_BOUNDS.z0 + d / 2);
  const p = geometry.attributes.position, dist = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) dist[i] = (shore(p.getZ(i) * UNIT) - p.getX(i) * UNIT) / UNIT;
  geometry.setAttribute('aDist', new BufferAttribute(dist, 1));
  return geometry;
}

const VERT = `uniform float uCurve; uniform vec3 uFocus; attribute float aDist; varying float vDist; varying vec3 vWorld;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vDist = aDist; float dz = wp.z - uFocus.z; wp.y -= dz * dz * uCurve; gl_Position = projectionMatrix * viewMatrix * wp; }`;
// v7 water with the foam lines and ripples drifting over time.
const FRAG = `uniform vec3 uShallow, uMid, uDeep, uFoam; uniform float uTime; varying float vDist; varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float d = vDist; if (d < -0.02) discard;
  float t = clamp(d / 10.0, 0.0, 1.0);
  vec3 col = mix(mix(uShallow, uMid, smoothstep(0.08, 0.4, t)), uDeep, smoothstep(0.4, 1.0, t));
  float a = mix(0.16, 0.95, smoothstep(0.0, 0.35, t));
  float wob = sin(vWorld.z * 0.9 + uTime * 0.7) * 0.35 + sin(vWorld.z * 2.3 + 1.0 - uTime * 0.5) * 0.12;
  float scal = abs(sin(vWorld.z * 3.4)) * 0.08, surge = 0.06 * sin(uTime * 0.84);
  float edge = 1.0 - smoothstep(0.03, 0.26, d + wob * 0.12 - scal - surge);
  float r1 = 1.0 - smoothstep(0.02, 0.09, abs(d - (0.62 + wob * 0.25 + scal + surge)));
  float r2 = (1.0 - smoothstep(0.02, 0.08, abs(d - (1.35 + wob * 0.4 + scal + surge * 1.5)))) * smoothstep(-0.2, 0.4, sin(vWorld.z * 0.5 + 1.3 + uTime * 0.2));
  float foam = max(edge, max(r1 * 0.95, r2 * 0.75));
  float rip = sin(vWorld.x * 3.1 + sin(vWorld.z * 2.0 + uTime * 0.6) * 1.5) * sin(vWorld.z * 2.7 - vWorld.x * 0.8 + uTime * 0.4);
  col += vec3(0.08) * smoothstep(0.5, 1.0, rip) * (1.0 - t * 0.4);
  col = mix(col, uFoam, foam * 0.94); a = max(a, foam * 0.97);
  if (hash(floor(vWorld.xz * vec2(9.0, 9.0))) > 0.994 && d > 1.6) { col = mix(col, uFoam, 0.8); a = max(a, 0.9); }
  gl_FragColor = vec4(col, a);
}`;

// Translucent sea drawn after opaque objects so the sloping sea floor shows through near the beach.
export function createWater(): Mesh<BufferGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uCurve: bend.uCurve, uFocus: bend.uFocus, uTime: {value: 0}, uShallow: {value: new Color(DAY.water[0])}, uMid: {value: new Color(DAY.water[1])}, uDeep: {value: new Color(DAY.water[2])}, uFoam: {value: new Color(DAY.foam)}},
    vertexShader: VERT, fragmentShader: FRAG,
  });
  const mesh = new Mesh(buildWaterGeometry(), material);
  mesh.position.y = -.05;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  return mesh;
}
