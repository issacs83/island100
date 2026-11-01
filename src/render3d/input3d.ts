import type {HeldKeys, IslandController} from '../island-controller';

// Movement keys by physical position (KeyboardEvent.code), so they also work under the Korean layout.
export function heldKeys(codes: ReadonlySet<string>): HeldKeys {
  return {
    up: codes.has('KeyW') || codes.has('ArrowUp'), down: codes.has('KeyS') || codes.has('ArrowDown'),
    left: codes.has('KeyA') || codes.has('ArrowLeft'), right: codes.has('KeyD') || codes.has('ArrowRight'),
    run: codes.has('ShiftLeft') || codes.has('ShiftRight'), sneak: codes.has('KeyC'),
  };
}
// Text fields keep their keys: typing a friend's name must not walk the hero.
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Keyboard, the E key and the on-screen joystick for the 3D view; same behaviour as the 2D scene's handlers.
export class Input3D {
  private codes = new Set<string>();

  constructor(private control: IslandController) {
    addEventListener('keydown', e => {
      if (typing(e.target)) return;
      this.codes.add(e.code);
      if (e.code === 'KeyE' && !e.repeat) this.control.pressAction();
    });
    addEventListener('keyup', e => { this.codes.delete(e.code); });
    addEventListener('blur', () => this.codes.clear());
    this.joystick();
  }

  keys(): HeldKeys { return heldKeys(this.codes); }

  private joystick() {
    const joy = document.getElementById('joystick');
    if (!joy) return;
    const knob = joy.firstElementChild as HTMLElement | null;
    let pointer: number | undefined;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const r = joy.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / 38, y = (e.clientY - r.top - r.height / 2) / 38, l = Math.max(1, Math.hypot(x, y));
      this.control.setJoystick(x / l, y / l);
      if (knob) knob.style.transform = `translate(${x / l * 30}px,${y / l * 30}px)`;
    };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); pointer = e.pointerId; joy.setPointerCapture(e.pointerId); this.control.pressJoystick(); move(e); });
    joy.addEventListener('pointermove', move);
    const release = () => { pointer = undefined; this.control.releaseJoystick(); if (knob) knob.style.transform = ''; };
    joy.addEventListener('pointerup', release);
    joy.addEventListener('pointercancel', release);
  }
}
