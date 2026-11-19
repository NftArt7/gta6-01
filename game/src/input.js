// Keyboard and mouse input: WASD/arrows to move and drive, E to steal or
// enter a car, Space for the handbrake, M to mute, P to pause. The mouse
// drag orbits the chase camera. Edge-triggered actions (interact, pause,
// mute) are consumed once per press.

export class Input {
  constructor() {
    this.keys = new Set();
    this.orbitDX = 0;
    this.orbitDY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.interactPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'KeyP') this.pausePressed = true;
      if (e.code === 'KeyM') this.mutePressed = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    window.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.orbitDX += e.clientX - this.lastX;
      this.orbitDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
  }

  // -1 (brake/reverse) .. +1 (full throttle).
  get throttleAxis() {
    const fwd = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const back = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    return (fwd ? 1 : 0) - (back ? 1 : 0);
  }

  // -1 (left) .. +1 (right).
  get steerAxis() {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  get handbrake() {
    return this.keys.has('Space');
  }

  get running() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  // Returns true once per E press.
  consumeInteract() {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  consumePause() {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  consumeMute() {
    const v = this.mutePressed;
    this.mutePressed = false;
    return v;
  }

  // Mouse drag since the last call, in pixels.
  consumeOrbit() {
    const dx = this.orbitDX;
    const dy = this.orbitDY;
    this.orbitDX = 0;
    this.orbitDY = 0;
    return { dx, dy };
  }
}
