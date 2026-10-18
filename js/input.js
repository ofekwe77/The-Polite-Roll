/* ==========================================================
   input.js — keyboard + touch input.
   Uses KeyboardEvent.code (physical keys), so the controls work
   the same with a Hebrew keyboard layout.
   ========================================================== */
(function (TP) {
  'use strict';

  // physical key -> actions
  const KEYMAP = {
    ArrowLeft: ['left'], KeyA: ['left'],
    ArrowRight: ['right'], KeyD: ['right'],
    ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'],
    ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump', 'confirm'],
    Enter: ['confirm'], NumpadEnter: ['confirm'],
    KeyP: ['pause'], Escape: ['pause', 'back'],
    KeyR: ['restart'], KeyM: ['mute'], KeyF: ['fullscreen']
  };
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

  const keysDown = new Set();
  const touchHeld = { left: false, right: false, jump: false };
  const pressed = new Set();
  let lastHeld = {};
  let onFirstGesture = null;
  let usedTouch = false;

  function heldNow() {
    const h = { left: touchHeld.left, right: touchHeld.right, jump: touchHeld.jump, up: false, down: false };
    for (const code of keysDown) {
      const acts = KEYMAP[code];
      if (acts) for (const a of acts) h[a] = true;
    }
    return h;
  }

  /** Record rising edges as "pressed" actions. */
  function refreshEdges() {
    const h = heldNow();
    for (const a of ['left', 'right', 'jump', 'up', 'down']) {
      if (h[a] && !lastHeld[a]) pressed.add(a);
    }
    lastHeld = h;
  }

  function gesture() {
    if (onFirstGesture) onFirstGesture();
  }

  window.addEventListener('keydown', (e) => {
    gesture();
    if (PREVENT.has(e.code)) e.preventDefault();
    const acts = KEYMAP[e.code];
    if (!acts) return;
    if (!e.repeat) {
      keysDown.add(e.code);
      for (const a of acts) {
        if (a === 'left' || a === 'right' || a === 'jump' || a === 'up' || a === 'down') continue;
        pressed.add(a);
      }
      refreshEdges();
    }
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
    refreshEdges();
  });

  window.addEventListener('blur', () => {
    keysDown.clear();
    touchHeld.left = touchHeld.right = touchHeld.jump = false;
    refreshEdges();
  });

  // ---------------- touch buttons ----------------
  // One handler for all touches: each finger is tested against every
  // button rect, so sliding between left/right works and jumping can be
  // held at the same time.
  let buttons = [];
  function bindTouch(container, map) {
    buttons = map;
    const update = (e) => {
      e.preventDefault();
      gesture();
      usedTouch = true;
      const now = { left: false, right: false, jump: false };
      for (const t of e.touches) {
        for (const b of buttons) {
          const r = b.el.getBoundingClientRect();
          const pad = 10;
          if (t.clientX >= r.left - pad && t.clientX <= r.right + pad && t.clientY >= r.top - pad && t.clientY <= r.bottom + pad) now[b.action] = true;
        }
      }
      for (const b of buttons) b.el.classList.toggle('down', now[b.action]);
      touchHeld.left = now.left;
      touchHeld.right = now.right;
      touchHeld.jump = now.jump;
      refreshEdges();
    };
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      container.addEventListener(ev, update, { passive: false });
    }
  }

  function releaseTouch() {
    touchHeld.left = touchHeld.right = touchHeld.jump = false;
    for (const b of buttons) b.el.classList.remove('down');
    refreshEdges();
  }

  TP.Input = {
    isDown(a) { return !!heldNow()[a]; },
    /** True once per press. */
    take(a) {
      if (pressed.has(a)) { pressed.delete(a); return true; }
      return false;
    },
    peek(a) { return pressed.has(a); },
    clearPresses() { pressed.clear(); },
    /** Simulated key press (used by on-canvas buttons and tests). */
    press(a) { pressed.add(a); },
    bindTouch, releaseTouch,
    set onFirstGesture(fn) { onFirstGesture = fn; },
    get usedTouch() { return usedTouch; },
    markTouch() { usedTouch = true; }
  };
})(window.TP = window.TP || {});
