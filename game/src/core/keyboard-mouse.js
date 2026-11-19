// Keyboard and pointer input for one browser tab. Held keys answer "is this down now", presses
// are queued until the simulation consumes them, and the pointer is reported in the game's
// 1280x720 logical space whatever size the canvas is drawn at.

const PREVENT_DEFAULT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
]);

/** The keys the game binds, so a stray key never blocks the page. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyJ', 'KeyK', 'KeyT', 'KeyC', 'KeyH', 'KeyR',
  'KeyM', 'KeyQ', 'KeyP', 'Digit1', 'Digit2', 'Digit3',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Enter', 'ShiftLeft', 'ShiftRight',
]);

export class KeyboardMouse {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 360, down: false, clicked: false };
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.mouse.down = false;
    });
    this.canvas.addEventListener('mousemove', (event) => this.trackPointer(event));
    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.trackPointer(event);
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.pressed.add('Mouse0');
      event.preventDefault();
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  trackPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.view;
    this.mouse.x = (event.clientX - rect.left - offsetX) / (scale || 1);
    this.mouse.y = (event.clientY - rect.top - offsetY) / (scale || 1);
  }

  /** The renderer reports where the logical 1280x720 field sits inside the window, in CSS px. */
  setViewport(scale, offsetX, offsetY) {
    this.view.scale = scale;
    this.view.offsetX = offsetX;
    this.view.offsetY = offsetY;
  }

  isDown(...codes) {
    for (let i = 0; i < codes.length; i += 1) if (this.held.has(codes[i])) return true;
    return false;
  }

  wasPressed(...codes) {
    for (let i = 0; i < codes.length; i += 1) if (this.pressed.has(codes[i])) return true;
    return false;
  }

  /** Call once per rendered frame, after the simulation has read the queue. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  /** Movement intent, normalised so diagonals are not faster: -1..1 on each axis. */
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    if (this.isDown('KeyW', 'ArrowUp')) y -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) y += 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y, magnitude: Math.min(1, length) };
  }

  wantsSprint() {
    return this.isDown('Space', 'ShiftLeft', 'ShiftRight');
  }

  wantsFire() {
    return this.mouse.down || this.isDown('KeyJ');
  }
}
