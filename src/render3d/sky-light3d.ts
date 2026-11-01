import {CanvasTexture, Color, DirectionalLight, Fog, HemisphereLight, SRGBColorSpace, type Scene, type Texture} from 'three';
import {DAY, NIGHT, mulberry, type Palette} from './look';

export type Daylight = {
  hemiSky: Color; hemiGround: Color; hemiIntensity: number; sunColor: Color; sunIntensity: number; sunOffset: [number, number, number];
  fog: Color; water: [Color, Color, Color]; foam: Color; tint: Color; exposure: number; bloomStrength: number; bloomThreshold: number; night: boolean;
};
// Blends the day and night palettes by nightStrength (0 day … 1 night); the light moves from sun to moon past half.
export function daylight(nightStrength: number): Daylight {
  const n = Math.min(1, Math.max(0, nightStrength));
  // a·(1−n) + b·n lands exactly on each palette at n = 0 and n = 1.
  const lerp = (a: number, b: number) => a * (1 - n) + b * n;
  const mix = (a: string, b: string) => { const ca = new Color(a), cb = new Color(b); return new Color(lerp(ca.r, cb.r), lerp(ca.g, cb.g), lerp(ca.b, cb.b)); };
  return {
    hemiSky: mix(DAY.hemi[0], NIGHT.hemi[0]), hemiGround: mix(DAY.hemi[1], NIGHT.hemi[1]), hemiIntensity: lerp(DAY.hemi[2], NIGHT.hemi[2]),
    sunColor: mix(DAY.sun[0], NIGHT.sun[0]), sunIntensity: lerp(DAY.sun[1], NIGHT.sun[1]), sunOffset: n < .5 ? DAY.sun[2] : NIGHT.sun[2],
    fog: mix(DAY.fog, NIGHT.fog), water: [mix(DAY.water[0], NIGHT.water[0]), mix(DAY.water[1], NIGHT.water[1]), mix(DAY.water[2], NIGHT.water[2])],
    foam: mix(DAY.foam, NIGHT.foam), tint: mix(DAY.tint, NIGHT.tint), exposure: lerp(DAY.exposure, NIGHT.exposure),
    bloomStrength: lerp(DAY.bloom[0], NIGHT.bloom[0]), bloomThreshold: lerp(DAY.bloom[1], NIGHT.bloom[1]), night: n >= .5,
  };
}

// Screen-space sky from the v7 scene: soft clouds by day, stars and a moon at night. Browser only.
export function skyTexture(palette: Palette, night: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const g = canvas.getContext('2d')!, gradient = g.createLinearGradient(0, 0, 0, 512);
  palette.sky.forEach((color, i) => gradient.addColorStop([0, .55, .8, 1][i], color));
  g.fillStyle = gradient; g.fillRect(0, 0, 512, 512);
  const r = mulberry(9);
  if (!night) {
    const shade = 'rgba(190,210,234,.96)';
    for (let i = 0; i < 5; i++) {
      const cx = 40 + i * 105 + r() * 40, cy = 40 + r() * 110, sc = .8 + r() * .6;
      const puffs = [[0, 0, 34], [-30, 8, 24], [30, 6, 26], [-12, -16, 26], [16, -18, 24], [52, 12, 18], [-52, 12, 16]];
      g.filter = 'blur(1.5px)'; g.fillStyle = shade; g.beginPath(); g.ellipse(cx, cy + 14 * sc, 62 * sc, 10 * sc, 0, 0, Math.PI * 2); g.fill();
      for (const [px, py, pr] of puffs) {
        const gx = cx + px * sc, gy = cy + py * sc, rr = pr * sc, puff = g.createRadialGradient(gx - rr * .3, gy - rr * .45, rr * .1, gx, gy, rr);
        puff.addColorStop(0, '#ffffff'); puff.addColorStop(.62, 'rgba(255,255,255,.93)'); puff.addColorStop(1, shade);
        g.fillStyle = puff; g.beginPath(); g.arc(gx, gy, rr, 0, Math.PI * 2); g.fill();
      }
      g.filter = 'none';
    }
  } else {
    for (let i = 0; i < 170; i++) { const size = r() < .1 ? 2.4 : 1.3; g.fillStyle = `rgba(255,252,232,${.35 + r() * .65})`; g.fillRect(r() * 512, r() * 300, size, size); }
    const moon = g.createRadialGradient(400, 70, 0, 400, 70, 64);
    moon.addColorStop(0, 'rgba(255,250,228,1)'); moon.addColorStop(.26, 'rgba(255,250,228,.95)'); moon.addColorStop(.32, 'rgba(190,210,255,.35)'); moon.addColorStop(1, 'rgba(190,210,255,0)');
    g.fillStyle = moon; g.fillRect(320, 0, 170, 150);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// Hemisphere fill plus one shadow-casting sun (or moon) that follows the focus.
export class SkyLight {
  readonly hemi = new HemisphereLight();
  readonly sun = new DirectionalLight();
  private dayTexture?: Texture;
  private nightTexture?: Texture;

  constructor(private scene: Scene, shadowSize: number) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(this.sun.shadow.camera, {left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -.0004;
    this.sun.shadow.normalBias = .03;
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new Fog(DAY.fog, 34, 70);
  }

  // One frame of light around the focus (scene units); fog starts a little past the focus.
  apply(d: Daylight, fx: number, fz: number, cameraDistance: number) {
    this.hemi.color.copy(d.hemiSky); this.hemi.groundColor.copy(d.hemiGround); this.hemi.intensity = d.hemiIntensity;
    this.sun.color.copy(d.sunColor); this.sun.intensity = d.sunIntensity;
    this.sun.position.set(fx + d.sunOffset[0], d.sunOffset[1], fz + d.sunOffset[2]);
    this.sun.target.position.set(fx, 0, fz);
    this.sun.target.updateMatrixWorld();
    const fog = this.scene.fog as Fog;
    fog.color.copy(d.fog); fog.near = cameraDistance + 20; fog.far = cameraDistance + 56;
    const wanted = d.night ? (this.nightTexture ??= skyTexture(NIGHT, true)) : (this.dayTexture ??= skyTexture(DAY, false));
    if (this.scene.background !== wanted) this.scene.background = wanted;
  }
}
