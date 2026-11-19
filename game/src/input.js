// Solmar City — keyboard + mouse input. Tracks held keys and edge-triggered
// presses; the game loop consumes presses once per frame via endFrame().
export function createInput() {
  const down = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR', 'KeyM',
    'KeyP', 'Space', 'ShiftLeft', 'ShiftRight', 'Enter', 'Escape',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ]);

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onMouseMove(e) {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);

  return {
    isDown(code) { return down.has(code); },
    wasPressed(code) { return pressed.has(code); },
    axis() {
      // -1..1 steering / movement axes from held keys.
      const x = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
        - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      const y = (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0)
        - (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    requestLock(el) {
      if (el && el.requestPointerLock) el.requestPointerLock();
    },
    onLockChange(cb) {
      document.addEventListener('pointerlockchange', () => {
        locked = document.pointerLockElement != null;
        cb(locked);
      });
    },
    endFrame() { pressed.clear(); },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
    },
  };
}
