/* ==========================================================
   sim.js — the deterministic game simulation.
   Player physics, toilet platforms (static, moving, unstable,
   slippery, golden), hazards, collectibles and collisions.

   Pure logic, no DOM: the same code runs in the browser and in
   tools/verify-levels.js (the level-completability bot).
   World state is plain data so it can be structuredClone()d.
   ========================================================== */
(function (TP) {
  'use strict';

  const TANK = TP.TOILET.tankW;
  const RISE = TP.TOILET.lidRise;
  const TAU = Math.PI * 2;

  const SHAKE_TIME = 0.65;      // unstable toilet: warning before it drops
  const FALL_TIME = 1.1;        // ...falling animation
  const RESPAWN_TIME = 2.6;     // ...gone, then rebuilt
  const GEYSER_H = 46;          // full height of a water splash
  const SOAP_W = 10;

  function approach(v, target, delta) {
    if (v < target) return Math.min(v + delta, target);
    if (v > target) return Math.max(v - delta, target);
    return v;
  }

  function emit(w, type, data) {
    const e = data || {};
    e.type = type;
    w.events.push(e);
  }

  // -------------------------------------------------------
  // Creation
  // -------------------------------------------------------
  function createWorld(levelIndex, persist) {
    const def = TP.LEVELS[levelIndex];
    const taken = (persist && persist.taken) || [];
    const w = {
      level: levelIndex,
      width: def.width,
      time: 0,
      frame: 0,
      events: [],
      completed: false,
      toilets: def.toilets.map((t, i) => ({
        id: i,
        x: t.x, y: t.y, w: t.w,
        f: t.f || 'R',
        c: t.c || 'white',
        type: t.type || 'normal',
        throne: !!t.throne,
        baseX: t.x, baseY: t.y,
        move: t.move ? { ax: t.move.ax || 0, ay: t.move.ay || 0, period: t.move.period, phase: t.move.phase || 0 } : null,
        geyser: t.geyser ? { period: t.geyser.period, offset: t.geyser.offset || 0, warn: t.geyser.warn || 0.8, active: t.geyser.active || 0.75 } : null,
        state: 'idle', timer: 0, fallV: 0, fallY: 0, flash: 0,
        prevX: t.x, prevY: t.y, dx: 0, dy: 0, vx: 0,
        gState: 'idle', gH: 0
      })),
      items: def.items.map((it, i) => ({ id: i, x: it.x, y: it.y, k: it.k || 'sheet', taken: taken.indexOf(i) >= 0 })),
      hazards: (def.hazards || []).map((h, i) => ({
        id: i, k: h.k,
        x0: h.x || 0, y0: h.y || 0,
        ax: h.ax || 0, ay: h.ay || 0,
        period: h.period || 3, phase: h.phase || 0,
        toilet: h.toilet == null ? -1 : h.toilet,
        speed: h.speed || 30,
        x: h.x || 0, y: h.y || 0, vx: 0, off: 0
      })),
      player: null
    };
    placeToilets(w);
    for (const t of w.toilets) { t.prevX = t.x; t.prevY = t.y; }
    placeHazards(w);
    const st = w.toilets[def.start || 0];
    w.player = {
      x: st.x + Math.round(st.w / 2), y: st.y,
      vx: 0, vy: 0, carry: 0,
      facing: 1,
      grounded: true, ground: { t: st.id, s: 'seat' },
      coyote: 0, buffer: 0, jumping: false,
      state: 'play', deadT: 0, cause: '',
      animT: 0, airT: 0, landT: 0, winT: 0
    };
    return w;
  }

  // -------------------------------------------------------
  // Surfaces (one-way platforms): every toilet has a seat and a tank lid
  // -------------------------------------------------------
  function toiletSolid(t) {
    return t.type !== 'unstable' || t.state === 'idle' || t.state === 'shake';
  }

  function surface(t, kind) {
    if (!toiletSolid(t)) return null;
    if (kind === 'seat') {
      return { t: t.id, s: 'seat', left: t.x, right: t.x + t.w, top: t.y, prevTop: t.prevY, dx: t.dx, vx: t.vx };
    }
    const left = t.f === 'R' ? t.x - TANK : t.x + t.w;
    return { t: t.id, s: 'lid', left: left, right: left + TANK, top: t.y - RISE, prevTop: t.prevY - RISE, dx: t.dx, vx: t.vx };
  }

  function surfaceOf(w, ref) {
    if (!ref) return null;
    const t = w.toilets[ref.t];
    return t ? surface(t, ref.s) : null;
  }

  function feetOverlap(px, s) {
    const h = TP.PHYS.footHalf;
    return px + h > s.left && px - h < s.right;
  }

  // -------------------------------------------------------
  // Toilets
  // -------------------------------------------------------
  function placeToilets(w) {
    for (const t of w.toilets) {
      if (t.move) {
        const a = TAU * (w.time / t.move.period) + t.move.phase;
        t.x = t.baseX + t.move.ax * Math.sin(a);
        t.y = t.baseY + t.move.ay * Math.sin(a);
      }
    }
  }

  function geyserPhase(t, time) {
    const g = t.geyser;
    const ph = ((time + g.offset) % g.period + g.period) % g.period;
    const activeStart = g.period - g.active;
    const warnStart = activeStart - g.warn;
    if (ph >= activeStart) {
      const k = ph - activeStart;
      // rise fast, hold, drop
      let h = GEYSER_H;
      if (k < 0.1) h = GEYSER_H * (k / 0.1);
      else if (k > g.active - 0.15) h = GEYSER_H * Math.max(0, (g.active - k) / 0.15);
      return { state: 'active', h: h, k: k };
    }
    if (ph >= warnStart) return { state: 'warn', h: 0, k: ph - warnStart };
    return { state: 'idle', h: 0, k: ph };
  }

  function stepToilets(w, dt) {
    for (const t of w.toilets) { t.prevX = t.x; t.prevY = t.y; }
    placeToilets(w);
    const p = w.player;
    for (const t of w.toilets) {
      t.dx = t.x - t.prevX;
      t.dy = t.y - t.prevY;
      t.vx = t.dx / dt;
      if (t.flash > 0) t.flash = Math.max(0, t.flash - dt);
      if (t.type === 'unstable') {
        if (t.state === 'shake') {
          t.timer += dt;
          if (t.timer >= SHAKE_TIME) { t.state = 'fall'; t.timer = 0; t.fallV = 0; emit(w, 'crumble', { t: t.id }); }
        } else if (t.state === 'fall') {
          t.timer += dt;
          t.fallV += 520 * dt;
          t.fallY += t.fallV * dt;
          if (t.timer >= FALL_TIME) { t.state = 'gone'; t.timer = 0; }
        } else if (t.state === 'gone') {
          t.timer += dt;
          // Rebuild only when the player is not standing in its space.
          const inside = p.x + 6 > t.x - TANK && p.x - 6 < t.x + t.w + TANK && p.y > t.y - RISE - 20 && p.y < t.y + 16;
          if (t.timer >= RESPAWN_TIME && !inside) {
            t.state = 'idle'; t.timer = 0; t.fallY = 0; t.fallV = 0; t.flash = 0.6;
            emit(w, 'rebuild', { t: t.id });
          }
        }
      }
      if (t.geyser) {
        const g = geyserPhase(t, w.time);
        if (g.state !== t.gState) {
          if (g.state === 'warn') emit(w, 'splashWarn', { t: t.id });
          if (g.state === 'active') emit(w, 'splash', { t: t.id });
        }
        t.gState = g.state;
        t.gH = g.h;
      }
    }
  }

  // -------------------------------------------------------
  // Hazards
  // -------------------------------------------------------
  function placeHazards(w) {
    for (const h of w.hazards) {
      if (h.k === 'plunger') {
        const a = TAU * (w.time / h.period) + h.phase;
        const nx = h.x0 + h.ax * Math.sin(a);
        h.vx = nx - h.x;
        h.x = nx;
        h.y = h.y0 + h.ay * Math.sin(a);
      } else if (h.k === 'soap') {
        const t = w.toilets[h.toilet];
        const span = Math.max(1, t.w - SOAP_W - 2);
        // triangle wave: constant speed, bounces at the seat ends
        const d = (w.time * h.speed + h.phase * span) % (2 * span);
        const off = d < span ? d : 2 * span - d;
        h.vx = d < span ? 1 : -1;
        h.off = off;
        h.x = t.x + 1 + off;
        h.y = t.y;
      }
    }
  }

  function hazardBoxes(w) {
    const out = [];
    for (const h of w.hazards) {
      if (h.k === 'plunger') out.push({ x0: h.x - 3, x1: h.x + 3, y0: h.y - 5, y1: h.y + 4, cause: 'plunger' });
      else if (h.k === 'soap') {
        const t = w.toilets[h.toilet];
        if (toiletSolid(t)) out.push({ x0: h.x + 1, x1: h.x + SOAP_W - 1, y0: h.y - 4, y1: h.y, cause: 'soap' });
      }
    }
    for (const t of w.toilets) {
      if (t.geyser && t.gState === 'active' && t.gH > 4) {
        out.push({ x0: t.x + 2, x1: t.x + t.w - 2, y0: t.y - t.gH, y1: t.y + 1, cause: 'water' });
      }
    }
    return out;
  }

  // -------------------------------------------------------
  // Player
  // -------------------------------------------------------
  function kill(w, cause) {
    const p = w.player;
    if (p.state !== 'play') return;      // never die twice
    p.state = 'dead';
    p.deadT = 0;
    p.cause = cause;
    p.grounded = false;
    p.ground = null;
    p.carry = 0;
    p.vx = 0;
    if (cause !== 'fall') p.vy = -190;
    emit(w, 'death', { cause: cause, x: p.x, y: p.y });
  }

  function land(w, p, s) {
    const t = w.toilets[s.t];
    p.y = s.top;
    p.vy = 0;
    p.grounded = true;
    p.ground = { t: s.t, s: s.s };
    p.jumping = false;
    p.carry = 0;
    p.landT = 0.12;
    const centre = (s.left + s.right) / 2;
    const perfect = s.s === 'seat' && Math.abs(p.x - centre) <= TP.PHYS.perfectDist;
    emit(w, 'land', { t: s.t, s: s.s, perfect: perfect, x: p.x, y: p.y, air: p.airT });
    p.airT = 0;
    if (t.type === 'unstable' && t.state === 'idle') {
      t.state = 'shake';
      t.timer = 0;
      emit(w, 'crack', { t: t.id });
    }
    if (t.type === 'golden' && !w.completed) {
      w.completed = true;
      p.state = 'win';
      p.winT = 0;
      p.vx = 0;          // stop right here — no sliding off the throne while bowing
      emit(w, 'complete', { t: t.id });
    }
  }

  function stepPlayer(w, inp, dt) {
    const p = w.player;
    const PH = TP.PHYS;
    p.animT += dt;
    if (p.landT > 0) p.landT = Math.max(0, p.landT - dt);

    if (p.state === 'dead') {
      p.deadT += dt;
      p.vy = Math.min(PH.maxFall, p.vy + PH.gravityDown * 0.8 * dt);
      p.y += p.vy * dt;
      return;
    }
    if (p.state === 'win') p.winT += dt;

    // Ride the surface we stand on.
    if (p.grounded) {
      const s = surfaceOf(w, p.ground);
      if (s) { p.x += s.dx; p.y = s.top; }
    }

    const ctrl = p.state === 'play';
    const dir = ctrl ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0;
    const gt = p.grounded ? w.toilets[p.ground.t] : null;
    const slip = !!(gt && gt.type === 'slippery');
    let accel, decel;
    if (p.grounded) {
      accel = slip ? PH.slipAccel : PH.groundAccel;
      decel = slip ? PH.slipDecel : PH.groundDecel;
    } else {
      accel = PH.airAccel;
      decel = PH.airDecel;
    }
    if (dir !== 0) {
      const turning = p.vx * dir < 0;
      p.vx = approach(p.vx, dir * PH.runSpeed, (turning ? accel + decel : accel) * dt);
      p.facing = dir;
    } else {
      p.vx = approach(p.vx, 0, decel * dt);
    }

    // Jump buffering + coyote time; no air jumps.
    if (ctrl && inp.jumpPressed) p.buffer = PH.buffer;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.grounded) p.coyote = PH.coyote;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (ctrl && p.buffer > 0 && p.coyote > 0) {
      const s = p.grounded ? surfaceOf(w, p.ground) : null;
      if (s) p.carry = s.vx;
      p.vy = -PH.jumpSpeed;
      p.grounded = false;
      p.ground = null;
      p.coyote = 0;
      p.buffer = 0;
      p.jumping = true;
      emit(w, 'jump', { x: p.x, y: p.y });
    }

    // Gravity (lighter while the jump button is held = variable jump height).
    if (!p.grounded) {
      let g = PH.gravityDown;
      if (p.vy < 0) g = p.jumping && inp.jumpHeld ? PH.gravityUp : PH.gravityCut;
      p.vy = Math.min(PH.maxFall, p.vy + g * dt);
      if (p.vy >= 0) p.jumping = false;
      p.airT += dt;
    }

    const prevY = p.y;
    p.x += (p.vx + (p.grounded ? 0 : p.carry)) * dt;
    if (!p.grounded) p.y += p.vy * dt;

    if (p.x < 6) { p.x = 6; if (p.vx < 0) p.vx = 0; p.carry = 0; }
    if (p.x > w.width - 6) { p.x = w.width - 6; if (p.vx > 0) p.vx = 0; p.carry = 0; }

    if (p.grounded) {
      const s = surfaceOf(w, p.ground);
      if (!s || !feetOverlap(p.x, s)) {
        // Walked off the edge (or the toilet crumbled away).
        p.carry = s ? s.vx : 0;
        p.grounded = false;
        p.ground = null;
      }
    } else if (p.vy >= 0) {
      // Swept one-way landing test against every seat and lid.
      let best = null;
      for (const t of w.toilets) {
        for (const kind of ['seat', 'lid']) {
          const s = surface(t, kind);
          if (!s || !feetOverlap(p.x, s)) continue;
          if (prevY <= s.prevTop + 0.01 && p.y >= s.top - 0.01) {
            if (!best || s.top < best.top) best = s;
          }
        }
      }
      if (best) land(w, p, best);
    }

    if (p.y > TP.H + 6) kill(w, 'fall');
  }

  function stepCollisions(w) {
    const p = w.player;
    if (p.state !== 'play') return;
    const PH = TP.PHYS;
    const bx0 = p.x - PH.bodyHalf, bx1 = p.x + PH.bodyHalf;
    const by0 = p.y - PH.bodyHeight, by1 = p.y - 1;
    for (const b of hazardBoxes(w)) {
      if (bx1 > b.x0 && bx0 < b.x1 && by1 > b.y0 && by0 < b.y1) { kill(w, b.cause); return; }
    }
    // Collectibles use a generous box (the whole sprite).
    const cx0 = p.x - 7, cx1 = p.x + 7, cy0 = p.y - 18, cy1 = p.y;
    for (const it of w.items) {
      if (it.taken) continue;
      if (cx1 > it.x - 4 && cx0 < it.x + 4 && cy1 > it.y - 4 && cy0 < it.y + 4) {
        it.taken = true;
        emit(w, 'collect', { id: it.id, k: it.k, x: it.x, y: it.y });
      }
    }
  }

  /**
   * Advance the world by dt.
   * input: { left, right, jumpHeld, jumpPressed }
   */
  function step(w, input, dt) {
    w.events.length = 0;
    w.time += dt;
    w.frame++;
    stepToilets(w, dt);
    placeHazards(w);
    stepPlayer(w, input, dt);
    stepCollisions(w);
  }

  TP.Sim = {
    createWorld, step, surface, surfaceOf, hazardBoxes, geyserPhase,
    SHAKE_TIME, GEYSER_H, SOAP_W
  };
})(window.TP = window.TP || {});
