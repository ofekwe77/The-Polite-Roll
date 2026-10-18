/* ==========================================================
   sprites.js — all pixel art, defined as character grids and
   pre-rendered once into small offscreen canvases.
   ========================================================== */
(function (TP) {
  'use strict';

  const P = TP.PAL;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function fromRows(rows, pal) {
    const h = rows.length;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function flipH(src) {
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  /** Rotate by a multiple of 90° (keeps pixels crisp). */
  function rot90(src, quarter) {
    const q = ((quarter % 4) + 4) % 4;
    const swap = q % 2 === 1;
    const c = makeCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate((q * Math.PI) / 2);
    g.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }

  // ---------------------------------------------------------
  // The polite toilet-paper roll (facing right).
  // ---------------------------------------------------------
  const ROLL_PAL = {
    H: '#ffffff', W: P.white, L: P.light, E: P.cream, S: '#b8a888', T: P.tan, U: P.brown,
    K: '#000000', R: P.red, r: P.dkRed, P: P.pink, D: '#a8a8a8'
  };

  // 16 cols x 15 rows. The top shows the white paper ring around a
  // small cardboard tube; the side is the roll's body.
  const BODY = [
    '.....HHHHHHHH...',
    '...HHHHTTTTHHHH.',
    '...HHHTTUUTTHHH.',
    '...HHHHTTTTHHHH.',
    '...ELHHHHHHHHLW.',
    '...EWLLLLLLLLWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '...EWWWWWWWWWWW.',
    '....SEWWWWWWWW..'
  ];

  // Face overlays: [x, y, char] relative to BODY.
  const FACES = {
    normal: [[10, 7, 'K'], [10, 8, 'K'], [13, 7, 'K'], [13, 8, 'K'],
             [10, 10, 'K'], [13, 10, 'K'], [11, 11, 'K'], [12, 11, 'K'], [9, 10, 'P']],
    blink:  [[9, 8, 'K'], [10, 8, 'K'], [12, 8, 'K'], [13, 8, 'K'],
             [10, 10, 'K'], [13, 10, 'K'], [11, 11, 'K'], [12, 11, 'K'], [9, 10, 'P']],
    happy:  [[9, 8, 'K'], [10, 7, 'K'], [11, 8, 'K'], [12, 8, 'K'], [13, 7, 'K'], [14, 8, 'K'],
             [10, 10, 'K'], [13, 10, 'K'], [11, 11, 'K'], [12, 11, 'K'], [9, 10, 'P']],
    panic:  [[9, 6, 'K'], [10, 6, 'K'], [9, 7, 'K'], [10, 7, 'K'], [9, 8, 'K'], [10, 8, 'K'],
             [12, 6, 'K'], [13, 6, 'K'], [12, 7, 'K'], [13, 7, 'K'], [12, 8, 'K'], [13, 8, 'K'],
             [11, 10, 'K'], [12, 10, 'K'], [11, 11, 'K'], [12, 11, 'K']],
    dead:   [[8, 6, 'K'], [10, 6, 'K'], [9, 7, 'K'], [8, 8, 'K'], [10, 8, 'K'],
             [12, 6, 'K'], [14, 6, 'K'], [13, 7, 'K'], [12, 8, 'K'], [14, 8, 'K'],
             [10, 10, 'K'], [11, 10, 'K'], [12, 10, 'K']]
  };

  const BOWTIE = [[9, 12, 'R'], [13, 12, 'R'], [9, 13, 'R'], [10, 13, 'R'], [11, 13, 'r'],
                  [12, 13, 'R'], [13, 13, 'R'], [9, 14, 'R'], [13, 14, 'R']];

  // The loose sheet: a free strip of paper hanging from the back of the
  // roll (never reconnecting, so it reads as paper, not a mug handle).
  // [x, y, char] with x relative to BODY (may be negative = behind).
  const TAILS = {
    a:    [[2, 5, 'W'], [1, 5, 'W'], [1, 6, 'W'], [0, 6, 'W'], [0, 7, 'W'], [-1, 7, 'W'], [0, 8, 'D'], [-1, 8, 'D'],
           [0, 9, 'W'], [-1, 9, 'W'], [-1, 10, 'W'], [-2, 10, 'W'], [-1, 11, 'D'], [-2, 11, 'D'], [-1, 12, 'W'], [-2, 12, 'W'], [-1, 13, 'W']],
    b:    [[2, 5, 'W'], [1, 5, 'W'], [1, 6, 'W'], [0, 6, 'W'], [1, 7, 'W'], [0, 7, 'W'], [0, 8, 'D'], [-1, 8, 'D'],
           [-1, 9, 'W'], [-2, 9, 'W'], [-1, 10, 'W'], [-2, 10, 'W'], [-2, 11, 'D'], [-3, 11, 'D'], [-2, 12, 'W'], [-3, 12, 'W'], [-3, 13, 'W']],
    back: [[2, 5, 'W'], [1, 5, 'W'], [1, 6, 'W'], [0, 6, 'W'], [-1, 6, 'W'], [-1, 7, 'D'], [-2, 7, 'D'], [-3, 7, 'W'], [-2, 8, 'W'],
           [-3, 8, 'W'], [-4, 8, 'W'], [-5, 9, 'W'], [-4, 9, 'W']],
    up:   [[2, 5, 'W'], [1, 4, 'W'], [2, 4, 'W'], [0, 3, 'W'], [1, 3, 'W'], [0, 2, 'D'], [-1, 2, 'D'], [-1, 1, 'W'], [0, 1, 'W'],
           [-1, 0, 'W'], [-2, 0, 'W']]
  };

  // Legs below the body (aligned with BODY columns).
  const LEGS = {
    stand:  ['......W....W....', '......W....W....', '......RR...RR...'],
    short:  ['......W....W....', '......RR...RR...'],
    spread: ['.....W.....W....', '....W.......W...', '...RR.......RR..'],
    pass:   ['.......W..W.....', '.......W..W.....', '.......RR.RR....'],
    spread2:['.....W.....W....', '....W.......RR..', '...RR...........'],
    tuck:   ['.....W....W.....', '....RR....RR....'],
    dangle: ['.....W.....W....', '....W.......W...', '....R.......R...']
  };

  const PW = 22;        // player canvas width
  const PH = 21;        // player canvas height
  const OX = 5;         // BODY column 0 inside the canvas
  const ANCHOR_R = 12 + OX - 3;   // feet centre (canvas x) facing right
  const ANCHOR_L = PW - ANCHOR_R; // ... facing left (mirrored)

  function playerFrame(o) {
    const legs = LEGS[o.legs || 'stand'];
    const grid = [];
    for (let y = 0; y < PH; y++) grid.push(new Array(PW).fill('.'));
    const set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < PW && y < PH) grid[y][x] = ch; };

    const body = BODY.map((r) => r.split(''));
    for (const [x, y, ch] of FACES[o.face || 'normal']) body[y][x] = ch;
    for (const [x, y, ch] of BOWTIE) body[y][x] = ch;
    if (o.squash) body.splice(8, o.squash);       // landing squash
    const bodyH = body.length;
    const top = PH - legs.length - bodyH + (o.bob || 0);
    for (let y = 0; y < bodyH; y++) {
      // Polite bow: the top of the roll tips forward.
      let shift = 0;
      if (o.bow) shift = y < 5 ? o.bow : y < 9 ? o.bow - 1 : 0;
      for (let x = 0; x < 16; x++) if (body[y][x] !== '.') set(x + OX + shift, y + top + (o.bow && y < 5 ? 1 : 0), body[y][x]);
    }
    for (const [x, y, ch] of TAILS[o.tail || 'a']) {
      const yy = Math.min(y, bodyH - 1) + top;
      if (grid[yy] && grid[yy][x + OX] === '.') set(x + OX, yy, ch);
    }
    for (let y = 0; y < legs.length; y++) {
      for (let x = 0; x < legs[y].length; x++) if (legs[y][x] !== '.') set(x + OX, PH - legs.length + y, legs[y][x]);
    }
    return fromRows(grid.map((r) => r.join('')), ROLL_PAL);
  }

  const PLAYER_DEFS = {
    idle0: { face: 'normal', tail: 'a', legs: 'stand' },
    idle1: { face: 'normal', tail: 'b', legs: 'short' },
    blink: { face: 'blink', tail: 'a', legs: 'stand' },
    run0:  { face: 'normal', tail: 'back', legs: 'spread' },
    run1:  { face: 'normal', tail: 'back', legs: 'pass', bob: -1 },
    run2:  { face: 'normal', tail: 'back', legs: 'spread2' },
    run3:  { face: 'normal', tail: 'back', legs: 'pass', bob: -1 },
    jump:  { face: 'normal', tail: 'back', legs: 'tuck' },
    fall:  { face: 'panic', tail: 'up', legs: 'dangle' },
    land:  { face: 'blink', tail: 'b', legs: 'short', squash: 2 },
    bow1:  { face: 'happy', tail: 'a', legs: 'stand', bow: 1 },
    bow2:  { face: 'happy', tail: 'b', legs: 'stand', bow: 2 },
    happy: { face: 'happy', tail: 'a', legs: 'stand' },
    dead:  { face: 'dead', tail: 'up', legs: 'dangle' }
  };

  const player = {};
  for (const k in PLAYER_DEFS) {
    const r = playerFrame(PLAYER_DEFS[k]);
    player[k] = { r: r, l: flipH(r) };
  }
  // Death spin: the "dead" frame in four 90° steps.
  const deadSpin = [0, 1, 2, 3].map((q) => rot90(player.dead.r, q));

  // ---------------------------------------------------------
  // Collectibles, hazards and decorations
  // ---------------------------------------------------------
  const ITEM_PAL = { Y: P.yellow, O: P.gold, W: '#ffffff', C: P.cyan, B: P.water };

  const sheet = [
    fromRows(['Y.Y.Y.Y', 'YYYYYYY', 'YWWYYYY', 'YWYYYYY', 'YYYYYYO', 'YYYYYOO', 'O.O.O.O'], ITEM_PAL),
    fromRows(['Y.Y.Y.Y', 'YYYYYYY', 'YYYYYYY', 'YYYYWYY', 'YYYYYYO', 'YYYYYOO', 'O.O.O.O'], ITEM_PAL)
  ];
  const bubble = [
    fromRows(['..CCC..', '.C...C.', 'C.WW..C', 'C.W...C', 'C.....C', '.C...C.', '..CCC..'], ITEM_PAL),
    fromRows(['..CCC..', '.C...C.', 'C.....C', 'C..WW.C', 'C...W.C', '.C...C.', '..CCC..'], ITEM_PAL)
  ];
  const star = [
    fromRows(['...Y...', '..YYY..', 'YYYYYYY', '.YYWYY.', '..YYY..', '.YO.OY.', '.O...O.'], ITEM_PAL),
    fromRows(['...W...', '..YWY..', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YO.OY.', '.O...O.'], ITEM_PAL)
  ];

  const HZ_PAL = { U: P.brown, T: P.tan, W: P.white, R: P.red, r: P.dkRed, O: P.orange, o: '#a04c10', H: '#fcd0a0' };
  const plunger = [
    fromRows(['....U....', '....T....', 'WW..T..WW', '.WW.T.WW.', '..WWTWW..', '....T....', '....T....', '...RRR...', '..RRRRR..', '.RRRRRRR.', '.rrrrrrr.'], HZ_PAL),
    fromRows(['....U....', '....T....', '....T....', '..WWTWW..', '.WW.T.WW.', 'WW..T..WW', '....T....', '...RRR...', '..RRRRR..', '.RRRRRRR.', '.rrrrrrr.'], HZ_PAL)
  ];
  const soap = fromRows(['..OOOOOO..', '.OHHOOOOO.', 'OOHOOOOOOO', 'OOOOOOOOOO', '.oooooooo.'], HZ_PAL);

  const DECO_PAL = { Y: P.yellow, K: '#000000', R: P.red, C: P.cyan, O: P.gold, G: P.dkGreen, N: P.green, W: P.white, E: P.cream, T: P.tan, U: P.brown };
  const sign = fromRows(['..YY..', '.YKKY.', '.YKKY.', 'YYKKYY', 'YYYYYY', 'YYKKYY', 'YYYYYY', 'Y....Y'], DECO_PAL);
  const crown = fromRows(['Y...Y...Y', 'YY.YYY.YY', 'YYYYYYYYY', 'YRYYCYYRY', 'OOOOOOOOO'], DECO_PAL);
  const prop = [
    fromRows(['....G....', 'NNNNGNNNN'], DECO_PAL),
    fromRows(['....G....', '..NNGNN..'], DECO_PAL)
  ];
  const lifeIcon = fromRows(['.WWW.', 'WTUTW', 'EWWWW', 'EWKWK', 'EWWWW', '.EWW.'], DECO_PAL);
  // Game over: the roll has run out of paper — just a sad cardboard tube.
  const tube = fromRows([
    '....TTTTTTTT....',
    '..TTTUUUUUUTTT..',
    '..TTUUUUUUUUTT..',
    '..TTTUUUUUUTTT..',
    '..OTTTTTTTTTTT..',
    '..OTTTTTTTTTTT..',
    '..OTTKTTTTKTTT..',
    '..OTTKTTTTKTTT..',
    '..OTTCTTTTTTTT..',
    '..OTTTTKKTTTTT..',
    '..OTTTKTTKTTTT..',
    '..OTTTTTTTTTTT..',
    '..OTTTTTTTTTTT..',
    '...OTTTTTTTTT...',
    '....W......W....',
    '....W......W....',
    '...RR.....RR....'
  ], { T: P.tan, O: '#8c5430', U: P.brown, K: '#000000', C: P.cyan, W: P.white, R: P.red });

  // ---------------------------------------------------------
  // Toilets — side view, drawn procedurally for any seat width.
  // Facing 'R' = bowl opens to the right, tank on the left.
  // ---------------------------------------------------------
  const TANK = TP.TOILET.tankW;
  const RISE = TP.TOILET.lidRise;

  const TOILET_PAL = {
    white:  { body: P.white, shade: P.grey, dark: P.dimGrey, seat: P.white, seatShade: P.light, water: P.water, hi: '#ffffff' },
    blue:   { body: '#9cc4fc', shade: P.blue, dark: P.dim, seat: P.white, seatShade: '#9cc4fc', water: P.cyan, hi: '#ffffff' },
    gold:   { body: P.yellow, shade: P.gold, dark: P.tan, seat: P.yellow, seatShade: P.gold, water: P.cyan, hi: '#ffffff' },
    cracked:{ body: P.light, shade: '#7c7c7c', dark: P.dimGrey, seat: P.light, seatShade: P.grey, water: P.water, hi: P.white, crack: P.dimGrey },
    hot:    { body: P.light, shade: '#7c7c7c', dark: P.dimGrey, seat: P.light, seatShade: P.grey, water: P.water, hi: P.white, crack: P.orange },
    slip:   { body: '#c8f0fc', shade: P.water, dark: P.dim, seat: P.cyan, seatShade: P.water, water: P.cyan, hi: '#ffffff' },
    green:  { body: P.white, shade: P.grey, dark: P.dimGrey, seat: P.green, seatShade: P.dkGreen, water: P.water, hi: '#ffffff' },
    geyser: { body: P.white, shade: P.grey, dark: P.dimGrey, seat: P.white, seatShade: P.light, water: P.blue, hi: '#ffffff' }
  };

  const bowlRows = (w) => Math.max(6, Math.min(12, 4 + Math.round(w * 0.14)));
  /** Height below the seat top (seat ring + bowl + pedestal + base). */
  const belowSeat = (w) => 3 + bowlRows(w) + 4;

  function drawToilet(g, w, pal) {
    const T = TANK;
    const L = RISE;
    const rect = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
    // Tank with lid
    rect(0, 0, T, 1, pal.body);
    rect(0, 1, T, 1, pal.shade);
    rect(0, 2, T - 1, L + 2, pal.body);
    rect(0, 2, 1, L + 2, pal.shade);
    rect(T - 2, 2, 1, L + 2, pal.hi || pal.body);
    rect(T - 1, 2, 1, L + 2, pal.shade);
    rect(T - 1, 4, 2, 1, pal.dark);             // flush handle
    // Seat ring seen slightly from above (shows the water)
    rect(T, L, w, 1, pal.seat);
    rect(T, L + 1, 1, 1, pal.seat);
    rect(T + 1, L + 1, w - 2, 1, pal.water);
    rect(T + w - 1, L + 1, 1, 1, pal.seat);
    rect(T, L + 2, w, 1, pal.seatShade);
    // Bowl: tapers towards the pedestal; deeper for bigger toilets
    const rows = bowlRows(w);
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);
      const frontIn = Math.round(w * 0.36 * f * f + w * 0.04 * f);
      const backIn = Math.round(w * 0.18 * Math.max(0, f - 0.3) / 0.7);
      const x0 = T + backIn;
      const x1 = T + w - 1 - frontIn;
      if (x1 < x0) continue;
      rect(x0, L + 3 + r, x1 - x0 + 1, 1, r >= rows - 2 ? pal.shade : pal.body);
      rect(x1, L + 3 + r, 1, 1, pal.shade);
    }
    rect(T + w - 4, L + 4, 1, 1, pal.hi || pal.body);
    // Pedestal and base
    const py = L + 3 + rows;
    const p0 = T + Math.round(w * 0.2);
    const p1 = T + Math.round(w * 0.56);
    rect(p0, py, p1 - p0 + 1, 2, pal.body);
    rect(p1, py, 1, 2, pal.shade);
    const b0 = T + Math.round(w * 0.08);
    const b1 = T + Math.round(w * 0.68);
    rect(b0, py + 2, b1 - b0 + 1, 1, pal.body);
    rect(b0, py + 3, b1 - b0 + 1, 1, pal.shade);
    if (pal.crack) {
      const c = pal.crack;
      const pts = [[0.62, 2], [0.5, 4], [0.64, 6], [0.52, 8], [0.6, 9]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        for (let y = ay; y <= by; y++) {
          const t = (y - ay) / Math.max(1, by - ay);
          rect(T + Math.round((ax + (bx - ax) * t) * (w - 1)), L + y, 1, 1, c);
        }
      }
      rect(2, 4, 1, 1, c); rect(3, 5, 1, 1, c); rect(3, 6, 1, 1, c); rect(2, 7, 1, 1, c); rect(3, 8, 1, 1, c);
      rect(T + 2, L, 1, 1, c); rect(T + w - 4, L, 1, 1, c);
    }
  }

  const toiletCache = new Map();
  /** Returns a canvas; world draw offset is (seatX - ox, seatY - RISE). */
  function toilet(w, variant, facing) {
    const key = w + '|' + variant + '|' + facing;
    let c = toiletCache.get(key);
    if (!c) {
      c = makeCanvas(TANK + w, RISE + belowSeat(w));
      drawToilet(c.getContext('2d'), w, TOILET_PAL[variant] || TOILET_PAL.white);
      if (facing === 'L') c = flipH(c);
      toiletCache.set(key, c);
    }
    return c;
  }

  TP.Sprites = {
    makeCanvas, fromRows, flipH, rot90,
    player, deadSpin, PW, PH, ANCHOR_R, ANCHOR_L,
    sheet, bubble, star, plunger, soap, sign, crown, prop, lifeIcon, tube,
    toilet, TOILET_PAL, belowSeat
  };
})(window.TP = window.TP || {});
