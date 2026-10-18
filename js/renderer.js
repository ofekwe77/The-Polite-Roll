/* ==========================================================
   renderer.js — draws the game world onto the 320x180 canvas:
   starfield, toilets, water splashes, items, hazards, the roll,
   particles, score popups and speech bubbles.
   ========================================================== */
(function (TP) {
  'use strict';

  const W = TP.W;
  const H = TP.H;
  const P = TP.PAL;
  const F = TP.Font;
  const TANK = TP.TOILET.tankW;
  const RISE = TP.TOILET.lidRise;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const R = {
    stars: [],
    starSeed: -1,

    prepareStars(seed, width) {
      if (this.starSeed === seed) return;
      this.starSeed = seed;
      const r = rng(seed * 7919 + 17);
      const stars = [];
      const far = Math.ceil((width * 0.2 + W) / 6);
      for (let i = 0; i < far; i++) stars.push({ x: r() * (width * 0.2 + W), y: 12 + r() * 160, d: 0.2, c: r() < 0.7 ? P.dim : P.dimGrey, tw: r() < 0.3 ? r() * 6 : -1 });
      const near = Math.ceil((width * 0.45 + W) / 14);
      for (let i = 0; i < near; i++) stars.push({ x: r() * (width * 0.45 + W), y: 12 + r() * 150, d: 0.45, c: r() < 0.5 ? P.blue : P.grey, tw: r() < 0.4 ? r() * 6 : -1 });
      this.stars = stars;
    },

    background(ctx, camX, time) {
      ctx.fillStyle = P.black;
      ctx.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        if (s.tw >= 0 && ((time * 1.7 + s.tw) % 4) < 0.35) continue;
        const x = Math.round(s.x - camX * s.d);
        if (x < 0 || x >= W) continue;
        ctx.fillStyle = s.c;
        ctx.fillRect(x, Math.round(s.y), 1, 1);
      }
      // faint "abyss" mist at the very bottom
      ctx.fillStyle = P.night;
      const off = Math.floor(time * 6) % 8;
      for (let x = -8; x < W; x += 8) {
        ctx.fillRect(x + off, H - 3, 4, 1);
        ctx.fillRect(x + ((off + 4) % 8), H - 1, 4, 1);
      }
    },

    toiletVariant(t) {
      if (t.type === 'golden') return 'gold';
      if (t.type === 'slippery') return 'slip';
      if (t.type === 'moving') return 'green';
      if (t.type === 'unstable') return t.state === 'shake' ? 'hot' : 'cracked';
      if (t.geyser) return 'geyser';
      return t.c === 'blue' ? 'blue' : 'white';
    },

    toilet(ctx, t, camX, time, frame) {
      if (t.state === 'gone') return;
      if (t.flash > 0 && Math.floor(t.flash * 20) % 2 === 0) return;   // rebuilt: blink in
      const cv = TP.Sprites.toilet(t.w, this.toiletVariant(t), t.f);
      let sx = (t.f === 'R' ? t.x - TANK : t.x) - camX;
      let sy = t.y - RISE + t.fallY;
      if (t.state === 'shake') sx += frame % 4 < 2 ? 1 : -1;
      sx = Math.round(sx);
      sy = Math.round(sy);
      ctx.drawImage(cv, sx, sy);
      const seatX = Math.round(t.x - camX + (t.state === 'shake' ? (frame % 4 < 2 ? 1 : -1) : 0));
      const seatY = Math.round(t.y + t.fallY);
      const lidX = t.f === 'R' ? seatX - TANK : seatX + t.w;
      const baseCx = t.f === 'R' ? seatX + Math.round(t.w * 0.38) : seatX + t.w - Math.round(t.w * 0.38) - 1;
      const bottom = seatY + TP.Sprites.belowSeat(t.w);

      if (t.type === 'moving') {
        const pr = TP.Sprites.prop[frame % 8 < 4 ? 0 : 1];
        ctx.drawImage(pr, baseCx - 4, bottom);
      }
      if (t.type === 'slippery') {
        ctx.drawImage(TP.Sprites.sign, lidX, seatY - RISE - 8);
        // drips under the bowl
        const k = (time * 1.4 + t.id * 0.37) % 1;
        ctx.fillStyle = P.cyan;
        ctx.fillRect(baseCx + 2, bottom - 1 + Math.floor(k * 14), 1, 2);
        const k2 = (time * 1.4 + t.id * 0.37 + 0.5) % 1;
        ctx.fillRect(baseCx - 3, bottom - 3 + Math.floor(k2 * 16), 1, 1);
      }
      if (t.type === 'golden') {
        if (t.throne) ctx.drawImage(TP.Sprites.crown, lidX - 1, seatY - RISE - 5);
        // sparkles
        for (let i = 0; i < 5; i++) {
          const ph = (time * 0.9 + i * 0.211 + t.id) % 1;
          if (ph > 0.55) continue;
          const px = seatX - 6 + Math.floor(((i * 37 + Math.floor(time * 0.9 + i * 0.211)) * 53) % (t.w + 16));
          const py = seatY - 16 + ((i * 29) % 26);
          ctx.fillStyle = ph < 0.2 ? P.white : P.yellow;
          ctx.fillRect(px, py, 1, 1);
          if (ph > 0.15 && ph < 0.4) {
            ctx.fillRect(px - 1, py, 3, 1);
            ctx.fillRect(px, py - 1, 1, 3);
          }
        }
      }
      if (t.geyser && toiletUp(t)) this.geyser(ctx, t, seatX, seatY, time, frame);
    },

    geyser(ctx, t, seatX, seatY, time, frame) {
      const x0 = seatX + 2;
      const x1 = seatX + t.w - 2;
      if (t.gState === 'warn') {
        // bubbles inside the bowl + blinking warning mark
        ctx.fillStyle = P.white;
        for (let i = 0; i < 4; i++) {
          const bx = x0 + ((i * 7 + frame) % Math.max(1, x1 - x0));
          const by = seatY - ((frame + i * 5) % 6);
          ctx.fillRect(bx, by, 1, 1);
        }
        ctx.fillStyle = P.cyan;
        ctx.fillRect(seatX + 1, seatY + 1, t.w - 2, 1);
        if (frame % 16 < 10) F.draw(ctx, '!', seatX + t.w / 2, seatY - 18, { color: P.orange, align: 'center' });
      } else if (t.gState === 'active' && t.gH > 0) {
        const h = Math.round(t.gH);
        const top = seatY - h;
        for (let y = top; y <= seatY; y++) {
          const wob = Math.round(Math.sin((y + frame * 1.5) * 0.45));
          const l = x0 + wob;
          const r = x1 + wob;
          ctx.fillStyle = (y + frame) % 6 < 2 ? P.cyan : P.water;
          ctx.fillRect(l, y, r - l, 1);
          ctx.fillStyle = P.white;
          if ((y + frame) % 5 === 0) ctx.fillRect(l + 1 + ((y * 3) % Math.max(1, r - l - 2)), y, 1, 1);
        }
        // foam crown + droplets
        ctx.fillStyle = P.white;
        ctx.fillRect(x0 - 1, top - 1, x1 - x0 + 2, 2);
        for (let i = 0; i < 6; i++) {
          const dx = x0 - 3 + ((i * 11 + frame * 2) % (x1 - x0 + 6));
          const dy = top - 2 - ((i * 3 + frame) % 7);
          ctx.fillStyle = i % 2 ? P.cyan : P.white;
          ctx.fillRect(dx, dy, 1, 1);
        }
      }
    },

    item(ctx, it, camX, time) {
      if (it.taken) return;
      const bob = Math.round(Math.sin(time * 3 + it.id * 1.3) * 1.5);
      let spr;
      if (it.k === 'star') spr = TP.Sprites.star[Math.floor(time * 4 + it.id) % 2];
      else if (it.k === 'bubble') spr = TP.Sprites.bubble[Math.floor(time * 2 + it.id) % 2];
      else spr = TP.Sprites.sheet[Math.floor(time * 3 + it.id) % 7 === 0 ? 1 : 0];
      ctx.drawImage(spr, Math.round(it.x - 3 - camX), Math.round(it.y - 3 + bob));
    },

    hazard(ctx, h, w, camX, time, frame) {
      if (h.k === 'plunger') {
        const spr = TP.Sprites.plunger[frame % 12 < 6 ? 0 : 1];
        ctx.drawImage(spr, Math.round(h.x - 4 - camX), Math.round(h.y - 6));
      } else if (h.k === 'soap') {
        const t = w.toilets[h.toilet];
        if (!toiletUp(t)) return;
        const sx = Math.round(h.x - camX + (t.state === 'shake' ? (frame % 4 < 2 ? 1 : -1) : 0));
        const sy = Math.round(t.y + t.fallY);
        ctx.drawImage(TP.Sprites.soap, sx, sy - 5);
        // bubble trail
        ctx.fillStyle = P.cyan;
        const back = h.vx > 0 ? sx - 2 : sx + 11;
        if (frame % 10 < 6) ctx.fillRect(back, sy - 3 - (frame % 5 === 0 ? 1 : 0), 1, 1);
        ctx.fillStyle = P.white;
        if (frame % 14 < 7) ctx.fillRect(back + (h.vx > 0 ? -2 : 2), sy - 6, 1, 1);
      }
    },

    playerFrame(p, time) {
      const S = TP.Sprites.player;
      if (p.state === 'win') {
        const c = p.winT % 2.2;
        if (p.winT < 0.35 || c < 0.5) return S.happy;
        if (c < 0.65) return S.bow1;
        if (c < 1.45) return S.bow2;
        if (c < 1.6) return S.bow1;
        return S.happy;
      }
      if (p.grounded) {
        if (p.landT > 0) return S.land;
        if (Math.abs(p.vx) > 12) return S['run' + (Math.floor(p.animT * 12) % 4)];
        if ((p.animT % 3.2) > 3.05) return S.blink;
        return (p.animT % 1) < 0.5 ? S.idle0 : S.idle1;
      }
      if (p.vy > 60 && p.airT > 0.8) return S.fall;   // only long falls look panicked
      return S.jump;
    },

    player(ctx, p, camX, time) {
      if (p.state === 'dead') {
        const spin = TP.Sprites.deadSpin[Math.floor(p.deadT * 12) % 4];
        if (p.deadT > 1.2 && Math.floor(p.deadT * 16) % 2 === 0) return;
        ctx.drawImage(spin, Math.round(p.x - camX - spin.width / 2), Math.round(p.y - 10 - spin.height / 2));
        return;
      }
      const fr = this.playerFrame(p, time);
      const right = p.facing > 0;
      const ax = right ? TP.Sprites.ANCHOR_R : TP.Sprites.ANCHOR_L;
      ctx.drawImage(right ? fr.r : fr.l, Math.round(p.x) - ax - Math.round(camX), Math.round(p.y) - TP.Sprites.PH);
    },

    speech(ctx, text, px, py, camX) {
      const tw = F.measure(text);
      const bw = tw + 8;
      const bh = 13;
      let bx = Math.round(px - camX - bw / 2);
      bx = Math.max(2, Math.min(W - bw - 2, bx));
      const by = Math.max(14, Math.round(py - 22 - bh - 3));
      ctx.fillStyle = P.white;
      ctx.fillRect(bx + 1, by, bw - 2, bh);
      ctx.fillRect(bx, by + 1, bw, bh - 2);
      const tx = Math.max(bx + 3, Math.min(bx + bw - 4, Math.round(px - camX)));
      ctx.fillRect(tx - 1, by + bh, 3, 1);
      ctx.fillRect(tx - (px - camX > bx + bw / 2 ? 0 : 1), by + bh + 1, 2, 1);
      F.draw(ctx, text, bx + Math.floor(bw / 2), by + 3, { color: '#000000', align: 'center' });
    },

    hint(ctx, h, camX, touch) {
      const x = Math.round(h.x - camX);
      if (x < -120 || x > W + 120) return;
      F.draw(ctx, touch && h.touch ? h.touch : h.text, x, h.y, { color: P.cyan, align: 'center', shadow: P.night });
    },

    /** Everything that scrolls with the camera. */
    world(ctx, game) {
      const w = game.world;
      const camX = game.cam.x;
      const time = w.time;
      const frame = w.frame;
      this.background(ctx, camX, game.clock);
      const def = TP.LEVELS[w.level];
      if (def.hints) for (const h of def.hints) this.hint(ctx, h, camX, game.touchMode);
      for (const t of w.toilets) this.toilet(ctx, t, camX, time, frame);
      for (const it of w.items) this.item(ctx, it, camX, time);
      for (const h of w.hazards) this.hazard(ctx, h, w, camX, time, frame);
      this.player(ctx, w.player, camX, time);
      // particles
      for (const p of game.fx.parts) {
        ctx.fillStyle = p.c;
        const s = p.s || 1;
        ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), s, s);
      }
      // score popups
      for (const pop of game.fx.pops) {
        const k = pop.t / pop.dur;
        if (k > 0.7 && Math.floor(pop.t * 20) % 2 === 0) continue;
        F.draw(ctx, pop.text, Math.round(pop.x - camX), Math.round(pop.y - k * 16), { color: pop.color, align: 'center', shadow: '#000000' });
      }
      const sp = game.fx.speech;
      if (sp) {
        const ax = sp.anchor ? sp.anchor.x : w.player.x;
        const ay = sp.anchor ? sp.anchor.y : w.player.y;
        this.speech(ctx, sp.text, ax, ay, camX);
      }
    }
  };

  function toiletUp(t) {
    return t.type !== 'unstable' || t.state === 'idle' || t.state === 'shake';
  }

  TP.Renderer = R;
})(window.TP = window.TP || {});
