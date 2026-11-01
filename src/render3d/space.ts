import {type PerspectiveCamera, Raycaster, Vector2, Vector3} from 'three';

// One scene unit is 64 game pixels: game x → scene X, game y (south) → scene Z, height → scene Y.
export const UNIT = 64;
// Rolling-log horizon from the approved v7 test scene: the ground drops by (z − focusZ)² · CURVE.
export const CURVE = .0068;
export const FOV = 34;
// v7 camera: 5.4 up and 12.6 back from a look-at point 0.5 above the focus (about 23° down).
export const PITCH = Math.atan2(5.4, 12.6);
export const LOOK_HEIGHT = .5;
const WIDE_VIEW = 14.9, NARROW_VIEW = 6.5, CSS_PX_PER_UNIT = 86, MIN_DISTANCE = 10, MAX_DISTANCE = 26;

// A target on screen: a rectangle (a tree's trunk) plus an optional crown ellipse; depth is the distance from the camera in scene units.
export type ScreenBox = {id: string; left: number; top: number; right: number; bottom: number; depth: number; seeThrough: boolean; crown?: {x: number; y: number; rx: number; ry: number}};
// See-through circle around the hero in CSS pixels, with his distance from the camera.
export type SeeCircle = {x: number; y: number; r: number; depth: number};
// Objects within this many scene units behind the nearest one under a click still compete by centre distance.
const DEPTH_BAND = 1;

export const bendY = (y: number, z: number, focusZ: number) => y - (z - focusZ) ** 2 * CURVE;
// What the camera shows around the focus, measured from the camera itself (scene units): behind = how far behind the
// focus the bottom screen edge meets the ground, back = how far behind the focus the camera stands, spread = tangent of
// half the horizontal field of view. How far ahead to keep things depends on their height, so callers pass it.
export type ViewWindow = {behind: number; back: number; spread: number};
export function viewWindow(camera: PerspectiveCamera, focusZ: number, cssWidth: number, cssHeight: number): ViewWindow {
  const bottom = [0, cssWidth / 2, cssWidth].map(sx => pickGround(camera, focusZ, sx, cssHeight, cssWidth, cssHeight)).filter(p => p !== undefined);
  return {behind: Math.max(0, ...bottom.map(p => p.y / UNIT - focusZ)), back: camera.position.z - focusZ, spread: Math.tan(camera.fov * Math.PI / 360) * camera.aspect};
}
// True when the box [x0, x1] × [z0, z1] (scene units) reaches into the window: from `ahead` units ahead of the focus to
// the bottom screen edge behind it, as wide as the view is at the far end, all widened by `margin`.
export function inView(fx: number, fz: number, win: ViewWindow, ahead: number, margin: number, x0: number, x1: number, z0: number, z1: number) {
  const side = (win.back + ahead) * win.spread + margin;
  return x1 >= fx - side && x0 <= fx + side && z1 >= fz - ahead - margin && z0 <= fz + win.behind + margin;
}

// Ground width kept in view at the focus: the v7 framing on wide screens, about the 2D phone view on narrow ones.
export const viewWidth = (cssWidth: number) => Math.min(WIDE_VIEW, Math.max(NARROW_VIEW, cssWidth / CSS_PX_PER_UNIT));

// Camera distance that fits viewWidth() across the screen at the fixed vertical field of view.
export function cameraDistance(cssWidth: number, cssHeight: number) {
  const aspect = cssWidth / Math.max(1, cssHeight), halfWidthAngle = Math.atan(Math.tan(FOV * Math.PI / 360) * aspect);
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, viewWidth(cssWidth) / (2 * Math.tan(halfWidthAngle))));
}

// Puts the camera behind and above the focus (game pixels), refreshes its matrices and returns its distance.
export function aimCamera(camera: PerspectiveCamera, focus: {x: number; y: number}, cssWidth: number, cssHeight: number) {
  const distance = cameraDistance(cssWidth, cssHeight), fx = focus.x / UNIT, fz = focus.y / UNIT;
  camera.fov = FOV;
  camera.aspect = cssWidth / Math.max(1, cssHeight);
  camera.updateProjectionMatrix();
  camera.position.set(fx, LOOK_HEIGHT + distance * Math.sin(PITCH), fz + distance * Math.cos(PITCH));
  camera.lookAt(fx, LOOK_HEIGHT, fz);
  camera.updateMatrixWorld(true);
  return distance;
}

const scratch = new Vector3();
// CSS-pixel position of a scene point after the horizon bend; depth is normalised device z (smaller is nearer, above 1 is out of view).
export function projectScene(camera: PerspectiveCamera, focusZ: number, X: number, Y: number, Z: number, cssWidth: number, cssHeight: number) {
  scratch.set(X, bendY(Y, Z, focusZ), Z).project(camera);
  return {x: (scratch.x + 1) / 2 * cssWidth, y: (1 - scratch.y) / 2 * cssHeight, depth: scratch.z};
}

const raycaster = new Raycaster(), ndc = new Vector2();
// Game point under a CSS-pixel position: the camera ray meets the bent ground y = −(z − focusZ)² · CURVE.
// Solved exactly as a quadratic in the ray parameter; undefined when the ray passes over the horizon.
export function pickGround(camera: PerspectiveCamera, focusZ: number, sx: number, sy: number, cssWidth: number, cssHeight: number): {x: number; y: number} | undefined {
  ndc.set(sx / cssWidth * 2 - 1, 1 - sy / cssHeight * 2);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction, u = o.z - focusZ;
  const a = CURVE * d.z * d.z, b = 2 * CURVE * u * d.z + d.y, c = CURVE * u * u + o.y;
  let t: number;
  if (a < 1e-12) t = Math.abs(b) < 1e-12 ? -1 : -c / b;
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return undefined;
    const root = Math.sqrt(disc), near = (-b - root) / (2 * a);
    t = near > 0 ? near : (-b + root) / (2 * a);
  }
  if (!(t > 0)) return undefined;
  return {x: (o.x + d.x * t) * UNIT, y: (o.z + d.z * t) * UNIT};
}

const view = new Vector3();
// Distance in front of the camera (scene units) of a bent scene point; negative behind it.
export const viewDistance = (camera: PerspectiveCamera, focusZ: number, X: number, Y: number, Z: number) => -view.set(X, bendY(Y, Z, focusZ), Z).applyMatrix4(camera.matrixWorldInverse).z;

// A ground point is in sight when it is in front of the camera and the ray to it does not meet the bent ground first.
export function groundVisible(camera: PerspectiveCamera, focusZ: number, x: number, y: number, cssWidth: number, cssHeight: number) {
  const X = x / UNIT, Z = y / UNIT;
  if (viewDistance(camera, focusZ, X, 0, Z) < camera.near) return false;
  const p = projectScene(camera, focusZ, X, 0, Z, cssWidth, cssHeight), g = pickGround(camera, focusZ, p.x, p.y, cssWidth, cssHeight);
  return !!g && Math.hypot(g.x - x, g.y - y) < UNIT / 2;
}

// See-through circle around the hero's chest (CSS pixels), sized to his height on screen.
export function seeCircle(camera: PerspectiveCamera, focusZ: number, x: number, y: number, cssWidth: number, cssHeight: number): SeeCircle {
  const X = x / UNIT, Z = y / UNIT, foot = projectScene(camera, focusZ, X, 0, Z, cssWidth, cssHeight);
  const head = projectScene(camera, focusZ, X, 1.7, Z, cssWidth, cssHeight), chest = projectScene(camera, focusZ, X, .8, Z, cssWidth, cssHeight);
  return {x: chest.x, y: chest.y, r: Math.max(60, (foot.y - head.y) * 1.1), depth: viewDistance(camera, focusZ, X, .8, Z)};
}

// Screen rectangle of an upright object w × h scene units standing at a game point.
export function standingBox(camera: PerspectiveCamera, focusZ: number, id: string, x: number, y: number, w: number, h: number, cssWidth: number, cssHeight: number, seeThrough = false): ScreenBox {
  const X = x / UNIT, Z = y / UNIT, foot = projectScene(camera, focusZ, X, 0, Z, cssWidth, cssHeight);
  const head = projectScene(camera, focusZ, X, h, Z, cssWidth, cssHeight), side = projectScene(camera, focusZ, X + w / 2, 0, Z, cssWidth, cssHeight);
  const half = Math.abs(side.x - foot.x), pad = (foot.y - head.y) * .08;
  return {id, left: foot.x - half, right: foot.x + half, top: head.y, bottom: foot.y + pad, depth: viewDistance(camera, focusZ, X, 0, Z), seeThrough};
}

// Trees are hit on the trunk or the round crown (the broadleaf canopy spans heights 1.55–3.95, 1.6 to each side),
// not on their whole bounding box, so a bug beside a trunk stays clickable.
export function treeBox(camera: PerspectiveCamera, focusZ: number, id: string, x: number, y: number, cssWidth: number, cssHeight: number): ScreenBox {
  const X = x / UNIT, Z = y / UNIT, trunk = standingBox(camera, focusZ, id, x, y, .7, 1.6, cssWidth, cssHeight, true);
  const c = projectScene(camera, focusZ, X, 2.75, Z, cssWidth, cssHeight), side = projectScene(camera, focusZ, X + 1.6, 2.75, Z, cssWidth, cssHeight), top = projectScene(camera, focusZ, X, 3.95, Z, cssWidth, cssHeight);
  return {...trunk, crown: {x: c.x, y: c.y, rx: Math.abs(side.x - c.x), ry: Math.abs(c.y - top.y)}};
}

// Rectangle around a box and its crown, for keyboard buttons and name tags.
export const boxBounds = (b: ScreenBox) => b.crown
  ? {left: Math.min(b.left, b.crown.x - b.crown.rx), right: Math.max(b.right, b.crown.x + b.crown.rx), top: Math.min(b.top, b.crown.y - b.crown.ry), bottom: b.bottom}
  : {left: b.left, right: b.right, top: b.top, bottom: b.bottom};

type Hit = {box: ScreenBox; distance: number};
// Of several hits, the nearest object wins; objects within DEPTH_BAND behind it compete by distance to the
// centre of the part clicked, ties going to the nearer.
function nearestInFront(hits: readonly Hit[]) {
  if (!hits.length) return undefined;
  const front = Math.min(...hits.map(h => h.box.depth));
  let best: Hit | undefined;
  for (const h of hits) {
    if (h.box.depth > front + DEPTH_BAND) continue;
    if (!best || h.distance < best.distance - 1e-6 || (Math.abs(h.distance - best.distance) <= 1e-6 && h.box.depth < best.box.depth)) best = h;
  }
  return best?.box.id;
}

// The target under a click. Rectangles (trunks, props, people, bugs) are precise and win over tree crowns, which are
// large soft areas, so small targets beside a tree stay clickable; within each group the nearest object wins (see
// nearestInFront). Inside the see-through circle, see-through objects in front of the hero are skipped so clicks
// reach the ground and targets around him.
export function pickBox(boxes: readonly ScreenBox[], sx: number, sy: number, see?: SeeCircle): string | undefined {
  const rects: Hit[] = [], crowns: Hit[] = [];
  for (const box of boxes) {
    if (see && box.seeThrough && box.depth < see.depth - .5 && Math.hypot(sx - see.x, sy - see.y) < see.r) continue;
    if (sx >= box.left && sx <= box.right && sy >= box.top && sy <= box.bottom) rects.push({box, distance: Math.hypot(sx - (box.left + box.right) / 2, sy - (box.top + box.bottom) / 2)});
    else if (box.crown && ((sx - box.crown.x) / box.crown.rx) ** 2 + ((sy - box.crown.y) / box.crown.ry) ** 2 <= 1) crowns.push({box, distance: Math.hypot(sx - box.crown.x, sy - box.crown.y)});
  }
  return nearestInFront(rects.length ? rects : crowns);
}
