/* ==========================================================
   ui.js — Hebrew menus, HUD and all game screens, drawn in the
   pixel font on the canvas. Menus work with the keyboard
   (↑ ↓ Enter / Esc) and with mouse clicks / screen taps.
   ========================================================== */
(function (TP) {
  'use strict';

  const W = TP.W;
  const H = TP.H;
  const P = TP.PAL;
  const F = TP.Font;
  const Input = TP.Input;
  const Audio = TP.Audio;

  let game = null;

  // ---------------------------------------------------------
  // Pointer support: regions are registered while drawing.
  // ---------------------------------------------------------
  let building = [];   // regions registered while drawing this frame
  let hits = [];       // regions of the last completed frame (used for input)
  let downId = null;

  function addHit(r) { building.push(r); }
  function hitAt(x, y) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const r = hits[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  }

  function bindPointer(canvas) {
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);
      const h = hitAt(p.x, p.y);
      if (h && h.hover && e.pointerType === 'mouse') h.hover();
      canvas.style.cursor = h ? 'pointer' : 'default';
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') Input.markTouch();
      const p = pos(e);
      const h = hitAt(p.x, p.y);
      downId = h ? h.id : null;
      if (h && h.hover) h.hover();
    });
    canvas.addEventListener('pointerup', (e) => {
      const p = pos(e);
      const h = hitAt(p.x, p.y);
      if (h && h.id === downId && h.click) {
        Audio.unlock();
        h.click();
      }
      downId = null;
    });
    canvas.addEventListener('pointercancel', () => { downId = null; });
  }

  // ---------------------------------------------------------
  // Menu
  // ---------------------------------------------------------
  function Menu(id, items) {
    this.id = id;
    this.items = items;
    this.index = 0;
  }
  Menu.prototype.visible = function () {
    return this.items.filter((it) => !it.show || it.show());
  };
  Menu.prototype.update = function () {
    const items = this.visible();
    if (!items.length) return;
    if (this.index >= items.length) this.index = 0;
    if (Input.take('up')) { this.index = (this.index + items.length - 1) % items.length; Audio.play('menuMove'); }
    if (Input.take('down')) { this.index = (this.index + 1) % items.length; Audio.play('menuMove'); }
    if (Input.take('confirm')) this.activate(this.index);
  };
  Menu.prototype.activate = function (i) {
    const items = this.visible();
    const it = items[i];
    if (!it || (it.enabled && !it.enabled())) return;
    Audio.play('menuSelect');
    it.action();
  };
  Menu.prototype.draw = function (ctx, cx, y, gap, width) {
    const items = this.visible();
    const blink = Math.floor(game.clock * 3) % 2 === 0;
    items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const sel = i === this.index;
      const off = it.enabled && !it.enabled();
      const yy = y + i * gap;
      const col = off ? P.dimGrey : sel ? P.yellow : P.white;
      const box = F.draw(ctx, label, cx, yy, { color: col, align: 'center', shadow: sel && !off ? P.dkRed : null });
      if (sel) {
        ctx.fillStyle = blink ? P.yellow : P.orange;
        // ◄ on the right side (start of an RTL line) and ► on the left
        tri(ctx, box.x + box.w + 5, yy + 3, -1);
        tri(ctx, box.x - 6, yy + 3, 1);
      }
      const ww = width || 150;
      const self = this;
      addHit({ id: this.id + ':' + i, x: cx - ww / 2, y: yy - 3, w: ww, h: gap, hover() { if (self.index !== i) { self.index = i; } }, click() { self.index = i; self.activate(i); } });
    });
  };

  function tri(ctx, x, y, dir) {
    // small pixel triangle pointing in dir (1 = right, -1 = left), centred on y
    for (let i = 0; i < 3; i++) {
      const h = 5 - i * 2;
      ctx.fillRect(dir > 0 ? x + i : x - i, y - 2 + i, 1, h);
    }
  }

  // ---------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------
  let ditherCanvas = null;
  function dither(ctx) {
    if (!ditherCanvas) {
      ditherCanvas = TP.Sprites.makeCanvas(W, H);
      const g = ditherCanvas.getContext('2d');
      g.fillStyle = '#000000';
      for (let y = 0; y < H; y++) for (let x = (y % 2); x < W; x += 2) g.fillRect(x, y, 1, 1);
    }
    ctx.drawImage(ditherCanvas, 0, 0);
  }

  function panel(ctx, x, y, w, h, border, inner) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = inner || P.dim;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
    ctx.fillRect(x + 2, y + 2, 1, h - 4);
    ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
  }

  const pad = (n, len) => String(Math.max(0, Math.floor(n))).padStart(len || 6, '0');

  function text(ctx, s, x, y, color, opts) {
    const o = opts || {};
    return F.draw(ctx, s, x, y, { color: color || P.white, align: o.align || 'center', scale: o.scale || 1, shadow: o.shadow || null });
  }

  /** A small clickable label button (used for back/next on touch screens). */
  function button(ctx, id, label, x, y, onClick, color) {
    const w = F.measure(label) + 10;
    const bx = Math.round(x - w / 2);
    ctx.fillStyle = P.night;
    ctx.fillRect(bx, y - 3, w, 13);
    ctx.fillStyle = color || P.dim;
    ctx.fillRect(bx, y - 3, w, 1);
    ctx.fillRect(bx, y + 9, w, 1);
    ctx.fillRect(bx, y - 3, 1, 13);
    ctx.fillRect(bx + w - 1, y - 3, 1, 13);
    text(ctx, label, x, y, P.white);
    addHit({ id: id, x: bx, y: y - 3, w: w, h: 13, click: () => { Audio.play('menuSelect'); onClick(); } });
  }

  function drawRoll(ctx, frameName, x, y, facing) {
    const S = TP.Sprites;
    const fr = S.player[frameName] || S.player.idle0;
    const right = facing !== -1;
    ctx.drawImage(right ? fr.r : fr.l, Math.round(x) - (right ? S.ANCHOR_R : S.ANCHOR_L), Math.round(y) - S.PH);
  }

  function bowCycle(t) {
    const c = t % 3.6;
    if (c < 2.0) return (t % 1) < 0.5 ? 'idle0' : 'idle1';
    if (c < 2.15) return 'bow1';
    if (c < 2.9) return 'bow2';
    if (c < 3.05) return 'bow1';
    return 'happy';
  }

  function drawToiletAt(ctx, w, variant, facing, seatX, seatY) {
    const cv = TP.Sprites.toilet(w, variant, facing);
    ctx.drawImage(cv, Math.round(facing === 'R' ? seatX - TP.TOILET.tankW : seatX), Math.round(seatY - TP.TOILET.lidRise));
  }

  // ---------------------------------------------------------
  // HUD
  // ---------------------------------------------------------
  function drawHUD(ctx) {
    const S = TP.Score;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, 11);
    ctx.fillStyle = P.dim;
    ctx.fillRect(0, 11, W, 1);
    let x = W - 3;
    const lab = (s, col) => { const b = F.draw(ctx, s, x, 2, { color: col || P.grey, align: 'right' }); x = b.x - 4; };
    lab('ניקוד');
    lab(pad(S.score), P.white);
    x -= 6;
    lab('שיא');
    lab(pad(S.high), P.yellow);
    x -= 6;
    lab('שלב');
    lab(String(game.li + 1), P.cyan);
    // lives as little rolls on the left
    let lx = 3;
    if (game.touchMode) {
      // pause button for touch screens
      ctx.fillStyle = P.white;
      ctx.fillRect(4, 2, 2, 7);
      ctx.fillRect(8, 2, 2, 7);
      addHit({ id: 'hud:pause', x: 0, y: 0, w: 18, h: 16, click: () => game.actions.pause() });
      lx = 18;
    }
    const icon = TP.Sprites.lifeIcon;
    for (let i = 0; i < S.lives; i++) ctx.drawImage(icon, lx + i * 7, 3);
  }

  // ---------------------------------------------------------
  // Screens
  // ---------------------------------------------------------
  const menus = {};

  function buildMenus() {
    const A = game.actions;
    const soundLabel = () => 'צליל: ' + (Audio.soundOn ? 'פועל' : 'כבוי');
    const musicLabel = () => 'מוזיקה: ' + (Audio.musicOn ? 'פועלת' : 'כבויה');
    menus.title = new Menu('title', [
      { label: 'התחל משחק', action: () => A.newGame(0) },
      { label: 'בחירת שלב', action: () => A.go('select'), show: () => TP.Score.reached > 0 },
      { label: 'הוראות', action: () => A.go('help') },
      { label: soundLabel, action: () => A.toggleSound() },
      { label: musicLabel, action: () => A.toggleMusic() },
      { label: 'מסך מלא', action: () => A.fullscreen(), show: () => game.canFullscreen }
    ]);
    menus.pause = new Menu('pause', [
      { label: 'המשך', action: () => A.resume() },
      { label: 'התחל שלב מחדש', action: () => A.restartLevel() },
      { label: soundLabel, action: () => A.toggleSound() },
      { label: musicLabel, action: () => A.toggleMusic() },
      { label: 'תפריט ראשי', action: () => A.go('title') }
    ]);
    menus.gameover = new Menu('gameover', [
      { label: 'משחק חדש', action: () => A.newGame(0) },
      { label: 'המשך מהשלב הזה', action: () => A.continueLevel() },
      { label: 'תפריט ראשי', action: () => A.go('title') }
    ]);
    menus.victory = new Menu('victory', [
      { label: 'שחק שוב', action: () => A.newGame(0) },
      { label: 'תפריט ראשי', action: () => A.go('title') }
    ]);
    const lv = TP.LEVELS.map((L, i) => ({
      label: () => (i <= TP.Score.reached ? 'שלב ' + (i + 1) + ' - ' + L.name : 'שלב ' + (i + 1) + ' - ???'),
      action: () => A.newGame(i),
      enabled: () => i <= TP.Score.reached
    }));
    lv.push({ label: 'חזרה', action: () => A.go('title') });
    menus.select = new Menu('select', lv);
  }

  const TITLE_LINES = ['שלום!', 'ברוכים הבאים!', 'בבקשה, היכנסו!', 'תודה שבאתם!', 'איזה יום נפלא!'];

  function drawTitle(ctx) {
    const t = game.clock;
    TP.Renderer.prepareStars(99, 2000);
    TP.Renderer.background(ctx, t * 12, t);
    text(ctx, 'גליל נייר הטואלט', W / 2, 8, P.white, { scale: 3, shadow: P.red });
    text(ctx, 'המנומס', W / 2, 33, P.yellow, { scale: 3, shadow: P.orange });
    text(ctx, 'קפוץ מאסלה לאסלה והגע לכס החרסינה!', W / 2, 62, P.cyan);

    // the host: a polite roll on a toilet, bowing to the player
    const seatX = 30;
    const seatY = 128;
    drawToiletAt(ctx, 30, 'white', 'R', seatX, seatY);
    const fr = bowCycle(t);
    drawRoll(ctx, fr, seatX + 15, seatY, 1);
    const li = Math.floor(t / 3.6) % TITLE_LINES.length;
    if ((t % 3.6) > 1.9) TP.Renderer.speech(ctx, TITLE_LINES[li], seatX + 15, seatY, 0);

    menus.title.draw(ctx, 200, 77, 12, 150);

    if (game.touchMode) {
      text(ctx, 'הקישו על "התחל משחק" כדי להתחיל', W / 2, 146, P.light);
      text(ctx, 'בזמן המשחק: כפתורי חצים וקפיצה על המסך', W / 2, 157, P.grey);
    } else {
      text(ctx, '← → / A D הליכה  ·  רווח / W / ↑ קפיצה', W / 2, 146, P.light);
      text(ctx, 'P / ESC עצירה  ·  R שלב מחדש  ·  M צליל', W / 2, 157, P.grey);
    }
    text(ctx, 'שיא ' + pad(TP.Score.high), W / 2, 169, P.yellow);
  }

  function drawHelp(ctx) {
    const t = game.clock;
    TP.Renderer.prepareStars(99, 2000);
    TP.Renderer.background(ctx, t * 4, t);
    const page = game.helpPage;
    text(ctx, page === 0 ? 'איך משחקים?' : 'מה מחכה בדרך?', W / 2, 6, P.yellow, { scale: 2, shadow: P.dkRed });
    text(ctx, (page + 1) + '/2', 10, 8, P.grey, { align: 'left' });
    if (page === 0) {
      text(ctx, 'קפצו מאסלה לאסלה והגיעו לאסלת הזהב.', W / 2, 26, P.white);
      text(ctx, 'אל תיפלו לחושך שבין האסלות!', W / 2, 37, P.orange);
      const rows = game.touchMode ? [
        ['כפתורי ← →', 'הליכה'],
        ['כפתור קפיצה', 'קפיצה (לחיצה ארוכה = גבוה יותר)'],
        ['כפתור II למעלה', 'עצירה'],
        ['גם מקלדת עובדת', 'חצים, רווח, P, R, M']
      ] : [
        ['← → / A D', 'הליכה'],
        ['רווח / W / ↑', 'קפיצה (לחיצה ארוכה = גבוה יותר)'],
        ['P / ESC', 'עצירה'],
        ['R', 'התחלת השלב מחדש'],
        ['M', 'השתקת צליל'],
        ['F', 'מסך מלא']
      ];
      rows.forEach((r, i) => {
        const y = 52 + i * 12;
        text(ctx, r[1], 196, y, P.white, { align: 'right' });
        text(ctx, r[0], 204, y, P.cyan, { align: 'left' });
      });
      text(ctx, 'נחיתה במרכז האסלה = +100 נימוסים!', W / 2, 128, P.green);
      text(ctx, 'אספו דפי זהב, בועות סבון וכוכבים.', W / 2, 140, P.light);
    } else {
      const S = TP.Sprites;
      const rows = [
        ['white', 'אסלה רגילה', 'נוחתים בבטחה'],
        ['green', 'אסלה זזה', 'תזמנו את הקפיצה'],
        ['cracked', 'אסלה סדוקה', 'מתפוררת אחרי רגע!'],
        ['slip', 'אסלה רטובה', 'חלקלקה מאוד'],
        ['geyser', 'מים מתיזים', 'חכו שהמים יירגעו'],
        ['plunger', 'פומפה מעופפת', 'התרחקו ממנה!'],
        ['soap', 'סבון מחליק', 'קפצו מעליו'],
        ['gold', 'אסלת זהב', 'סוף השלב!']
      ];
      rows.forEach((r, i) => {
        const col = i < 4 ? 0 : 1;
        const row = i % 4;
        const rx = col === 0 ? 312 : 156;
        const y = 26 + row * 27;
        const iconX = rx - 22;
        if (r[0] === 'plunger') ctx.drawImage(S.plunger[Math.floor(t * 5) % 2], iconX + 4, y + 2);
        else if (r[0] === 'soap') ctx.drawImage(S.soap, iconX + 3, y + 10);
        else {
          drawToiletAt(ctx, 12, r[0], 'R', iconX + 7, y + 8);
          if (r[0] === 'geyser') {
            ctx.fillStyle = P.water;
            ctx.fillRect(iconX + 9, y - 2, 8, 10);
            ctx.fillStyle = P.white;
            ctx.fillRect(iconX + 8, y - 3, 10, 1);
          }
          if (r[0] === 'green') ctx.drawImage(S.prop[Math.floor(t * 8) % 2], iconX + 8, y + 22);
        }
        text(ctx, r[1], rx - 26, y + 3, P.white, { align: 'right' });
        text(ctx, r[2], rx - 26, y + 13, P.grey, { align: 'right' });
      });
      // collectibles
      const y = 136;
      ctx.drawImage(S.sheet[0], 290, y - 1);
      text(ctx, '+50', 286, y, P.yellow, { align: 'right' });
      ctx.drawImage(S.bubble[0], 236, y - 1);
      text(ctx, '+50', 232, y, P.cyan, { align: 'right' });
      ctx.drawImage(S.star[0], 182, y - 1);
      text(ctx, '+100', 178, y, P.yellow, { align: 'right' });
      text(ctx, 'אוספים בדרך', 60, y, P.light);
    }
    const A = game.actions;
    button(ctx, 'help:back', 'חזרה', 40, 162, () => A.go('title'));
    button(ctx, 'help:next', page === 0 ? 'הבא ←' : '→ הקודם', W - 50, 162, () => { game.helpPage = 1 - game.helpPage; });
  }

  function drawSelect(ctx) {
    const t = game.clock;
    TP.Renderer.prepareStars(99, 2000);
    TP.Renderer.background(ctx, t * 4, t);
    text(ctx, 'בחירת שלב', W / 2, 10, P.yellow, { scale: 2, shadow: P.dkRed });
    text(ctx, 'משחק חדש מהשלב שתבחרו', W / 2, 32, P.grey);
    menus.select.draw(ctx, W / 2, 52, 16, 220);
  }

  function drawIntro(ctx) {
    const t = game.stateT;
    TP.Renderer.prepareStars(game.li + 1, 2000);
    TP.Renderer.background(ctx, game.clock * 8, game.clock);
    const L = TP.LEVELS[game.li];
    text(ctx, 'שלב ' + (game.li + 1), W / 2, 34, P.yellow, { scale: 2, shadow: P.dkRed });
    text(ctx, L.name, W / 2, 58, P.white, { scale: 3, shadow: P.blue });
    text(ctx, L.tip, W / 2, 94, P.cyan);
    drawToiletAt(ctx, 26, 'white', 'R', W / 2 - 13, 146);
    drawRoll(ctx, bowCycle(t + 1.6), W / 2, 146, 1);
    if (t > 0.3 && t < 2.2) TP.Renderer.speech(ctx, game.li === 4 ? 'הנה זה מתחיל!' : 'בהצלחה לי!', W / 2, 146, 0);
    if (t > 0.6 && Math.floor(t * 3) % 2 === 0) text(ctx, game.touchMode ? 'הקישו להתחלה' : 'ENTER / רווח להתחלה', W / 2, 166, P.grey);
    addHit({ id: 'intro:skip', x: 0, y: 0, w: W, h: H, click: () => game.actions.skipIntro() });
  }

  function drawPause(ctx) {
    dither(ctx);
    panel(ctx, 80, 34, 160, 116, P.cyan, P.dim);
    text(ctx, 'עצירה', W / 2, 44, P.cyan, { scale: 2, shadow: P.blue });
    menus.pause.draw(ctx, W / 2, 72, 14, 140);
  }

  function drawComplete(ctx) {
    dither(ctx);
    const tl = game.tally;
    panel(ctx, 56, 22, 208, 140, P.yellow, P.gold);
    text(ctx, 'שלב ' + (game.li + 1) + ' הושלם!', W / 2, 32, P.yellow, { scale: 2, shadow: P.dkRed });
    text(ctx, tl.quip, W / 2, 54, P.cyan);
    tl.lines.forEach((ln, i) => {
      if (i >= tl.shown) return;
      const y = 70 + i * 12;
      text(ctx, ln.label, 246, y, ln.ok ? P.white : P.grey, { align: 'right' });
      text(ctx, ln.ok ? '+' + ln.value : '-', 76, y, ln.ok ? P.green : P.grey, { align: 'left' });
    });
    if (tl.done) text(ctx, 'נקודות בשלב הזה: ' + (TP.Score.score - game.levelStartScore), W / 2, 110, P.light);
    text(ctx, 'ניקוד ' + pad(TP.Score.score), W / 2, 124, P.white);
    if (tl.done && Math.floor(game.clock * 3) % 2 === 0) {
      text(ctx, game.touchMode ? 'הקישו להמשך' : 'ENTER להמשך', W / 2, 142, P.yellow);
    }
    addHit({ id: 'complete:next', x: 0, y: 0, w: W, h: H, click: () => game.actions.confirmComplete() });
  }

  function drawGameOver(ctx) {
    const t = game.stateT;
    TP.Renderer.prepareStars(7, 2000);
    TP.Renderer.background(ctx, 0, game.clock);
    const shake = t < 0.6 ? Math.round(Math.sin(t * 60) * 2) : 0;
    text(ctx, 'נגמר הנייר!', W / 2 + shake, 10, P.red, { scale: 3, shadow: P.dkRed });
    text(ctx, 'המשחק נגמר', W / 2, 38, P.white, { scale: 2 });
    // the sad, empty cardboard tube
    ctx.drawImage(TP.Sprites.tube, W / 2 - 8, 79);
    if (t > 0.8) TP.Renderer.speech(ctx, 'סליחה... נגמר לי הנייר', W / 2, 96, 0);
    text(ctx, 'ניקוד ' + pad(TP.Score.score), W / 2 + 50, 104, P.white);
    text(ctx, 'שיא ' + pad(TP.Score.high), W / 2 - 50, 104, P.yellow);
    if (TP.Score.newHigh && Math.floor(game.clock * 4) % 2 === 0) text(ctx, 'שיא חדש!', W / 2, 115, P.green);
    if (t > 0.8) menus.gameover.draw(ctx, W / 2, 130, 14, 160);
  }

  // confetti for the final victory
  const confetti = [];
  function drawVictory(ctx, dt) {
    const t = game.stateT;
    TP.Renderer.prepareStars(5, 2000);
    TP.Renderer.background(ctx, game.clock * 3, game.clock);
    // golden rays
    ctx.fillStyle = P.night;
    for (let i = 0; i < 12; i++) {
      const a = i * (Math.PI / 6) + game.clock * 0.15;
      for (let r = 30; r < 170; r += 3) {
        ctx.fillRect(Math.round(W / 2 + Math.cos(a) * r), Math.round(132 + Math.sin(a) * r * 0.7), 2, 2);
      }
    }
    // the porcelain throne, double size (bottom at y=152, menu below it)
    const thr = TP.Sprites.toilet(56, 'gold', 'R');
    const ox = Math.round(W / 2 - thr.width);
    const oy = 152 - thr.height * 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(2, 2);
    ctx.drawImage(thr, 0, 0);
    ctx.drawImage(TP.Sprites.crown, -1, -5);
    const fr = TP.Sprites.player[bowCycle(t + 1.8)] || TP.Sprites.player.happy;
    ctx.drawImage(fr.r, TP.TOILET.tankW + 28 - TP.Sprites.ANCHOR_R, TP.TOILET.lidRise - TP.Sprites.PH);
    ctx.restore();
    // confetti
    if (confetti.length < 70 && Math.random() < 0.6) {
      const cols = [P.white, P.yellow, P.cyan, P.pink, P.green];
      confetti.push({ x: Math.random() * W, y: -4, vy: 18 + Math.random() * 30, vx: -8 + Math.random() * 16, c: cols[Math.floor(Math.random() * cols.length)], ph: Math.random() * 6 });
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.y += c.vy * dt;
      c.x += (c.vx + Math.sin(game.clock * 3 + c.ph) * 10) * dt;
      if (c.y > H + 4) { confetti.splice(i, 1); continue; }
      ctx.fillStyle = c.c;
      ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.floor(game.clock * 6 + c.ph) % 2 ? 2 : 1, 2);
    }
    text(ctx, 'איזה גליל מנומס!', W / 2, 6, P.yellow, { scale: 3, shadow: P.dkRed });
    text(ctx, 'הצלחת להגיע לכס החרסינה!', W / 2, 32, P.white, { scale: 1 });
    text(ctx, 'ניקוד סופי ' + pad(TP.Score.score), W / 2 + 52, 45, P.white);
    text(ctx, 'שיא ' + pad(TP.Score.high), W / 2 - 56, 45, P.yellow);
    if (TP.Score.newHigh && Math.floor(game.clock * 4) % 2 === 0) text(ctx, 'שיא חדש!', W / 2, 56, P.green);
    if (t > 1.2) menus.victory.draw(ctx, W / 2, 158, 11, 120);
  }

  function updateMenus() {
    const s = game.state;
    if (s === 'title') menus.title.update();
    else if (s === 'pause') menus.pause.update();
    else if (s === 'gameover' && game.stateT > 0.8) menus.gameover.update();
    else if (s === 'victory' && game.stateT > 1.2) menus.victory.update();
    else if (s === 'select') menus.select.update();
  }

  function resetMenu(name) {
    if (menus[name]) menus[name].index = 0;
  }

  TP.UI = {
    init(g) { game = g; buildMenus(); },
    beginFrame() { building = []; },
    endFrame() { hits = building; },
    hitAt,
    bindPointer, updateMenus, resetMenu, menus,
    drawHUD, drawTitle, drawHelp, drawSelect, drawIntro, drawPause, drawComplete, drawGameOver, drawVictory,
    panel, dither, text, pad
  };
})(window.TP = window.TP || {});
