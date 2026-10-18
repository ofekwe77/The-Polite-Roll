/* ==========================================================
   font.js — hand-made Hebrew + Latin pixel font with a tiny
   bidi layer, so Hebrew renders crisply inside the 320x180
   canvas (right-to-left, numbers/latin runs left-to-right).

   Glyph rows: 7-row body (cap line = row 0, baseline = row 6).
   Rows after index 6 are descenders; {a:n} marks n ascender rows.
   ========================================================== */
(function (TP) {
  'use strict';

  const RAW = {
    // ---------------- Hebrew ----------------
    'א': ['#...#', '.#..#', '.#..#', '..##.', '.#.#.', '.#.#.', '##..#'],
    'ב': ['####.', '...#.', '...#.', '...#.', '...#.', '...#.', '#####'],
    'ג': ['.##.', '..#.', '..#.', '..#.', '..##', '.#.#', '#..#'],
    'ד': ['#####', '...#.', '...#.', '...#.', '...#.', '...#.', '...#.'],
    'ה': ['#####', '....#', '#...#', '#...#', '#...#', '#...#', '#...#'],
    'ו': ['##', '.#', '.#', '.#', '.#', '.#', '.#'],
    'ז': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.'],
    'ח': ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#...#'],
    'ט': ['#.##.', '#.#.#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'י': ['##', '.#', '.#', '..', '..', '..', '..'],
    'כ': ['####.', '....#', '....#', '....#', '....#', '....#', '####.'],
    'ך': ['####.', '....#', '....#', '....#', '....#', '....#', '....#', '....#', '....#'],
    'ל': { a: 2, r: ['#....', '#....', '#####', '....#', '....#', '....#', '...#.', '..#..', '.#...'] },
    'מ': ['#..#.', '.##.#', '.#..#', '.#..#', '.#..#', '.#..#', '...##'],
    'ם': ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'],
    'נ': ['.##', '..#', '..#', '..#', '..#', '..#', '###'],
    'ן': ['##', '.#', '.#', '.#', '.#', '.#', '.#', '.#', '.#'],
    'ס': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'ע': ['#...#', '#...#', '.#..#', '..##.', '...#.', '..#..', '##...'],
    'פ': ['####.', '#...#', '##..#', '....#', '....#', '....#', '####.'],
    'ף': ['####.', '#...#', '##..#', '....#', '....#', '....#', '....#', '....#', '....#'],
    'צ': ['#...#', '.#..#', '..##.', '...#.', '....#', '....#', '#####'],
    'ץ': ['#...#', '.#..#', '.#.#.', '.##..', '.#...', '.#...', '.#...', '.#...', '.#...'],
    'ק': ['####.', '....#', '#...#', '#...#', '#...#', '#...#', '#..#.', '#....', '#....'],
    'ר': ['####.', '....#', '....#', '....#', '....#', '....#', '....#'],
    'ש': ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#...#', '#...#', '#####'],
    'ת': ['.####', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '##..#'],

    // ---------------- Digits (fixed width 4) ----------------
    '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
    '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '..#.', '.###'],
    '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
    '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
    '4': ['..#.', '.##.', '#.#.', '#.#.', '####', '..#.', '..#.'],
    '5': ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
    '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
    '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
    '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
    '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],

    // ---------------- Latin (uppercase only) ----------------
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

    // ---------------- Punctuation & symbols ----------------
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.##.', '#..#', '...#', '..#.', '.#..', '....', '.#..'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    ';': ['..', '..', '.#', '..', '..', '.#', '.#', '#.'],
    '-': ['...', '...', '...', '###', '...', '...', '...'],
    '+': ['...', '...', '.#.', '###', '.#.', '...', '...'],
    '=': ['...', '...', '###', '...', '###', '...', '...'],
    '/': ['...', '..#', '..#', '.#.', '#..', '#..', '...'],
    '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '×': ['...', '...', '#.#', '.#.', '#.#', '...', '...'],
    '·': ['.', '.', '.', '#', '.', '.', '.'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
    '<': ['...', '..#', '.##', '###', '.##', '..#', '...'],
    '>': ['...', '#..', '##.', '###', '##.', '#..', '...'],
    '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
    '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
    '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
    '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
    '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
    '★': ['..#..', '..#..', '#####', '.###.', '.###.', '.#.#.', '#...#']
  };

  const SPACE_W = 3;
  const SPACING = 1;
  const ASC = 2;              // rows reserved above the cap line
  const LINE_H = 11;          // ascender + body + descender
  const MIRROR = { '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[' };

  const GLYPHS = {};
  for (const ch in RAW) {
    const def = RAW[ch];
    const a = Array.isArray(def) ? 0 : def.a;
    const rows = Array.isArray(def) ? def : def.r;
    let w = 0;
    const px = [];
    rows.forEach((row, ri) => {
      w = Math.max(w, row.length);
      for (let x = 0; x < row.length; x++) if (row[x] === '#') px.push(x, ri - a);
    });
    GLYPHS[ch] = { w, px };
  }

  const isHeb = (c) => c >= '֐' && c <= '׿';
  const isLtr = (c) => /[A-Za-z0-9]/.test(c);
  const isDigit = (c) => c >= '0' && c <= '9';

  /** Convert a logical-order string into visual (left→right) glyph order. */
  function visual(str) {
    const chars = Array.from(String(str));
    const n = chars.length;
    const dir = new Array(n);
    let strongR = false;
    for (let i = 0; i < n; i++) {
      const c = chars[i];
      if (isHeb(c)) { dir[i] = 'R'; strongR = true; } else if (isLtr(c)) dir[i] = 'L'; else dir[i] = 'N';
    }
    if (!strongR) return chars;
    // "+100", "-5": the sign belongs to the number
    for (let i = 0; i < n - 1; i++) {
      if ((chars[i] === '+' || chars[i] === '-') && isDigit(chars[i + 1])) dir[i] = 'L';
    }
    // "1,000" / "10:30" / "3.5": separators inside numbers stay with the number
    for (let i = 1; i < n - 1; i++) {
      if ((chars[i] === ',' || chars[i] === '.' || chars[i] === ':') && isDigit(chars[i - 1]) && isDigit(chars[i + 1])) dir[i] = 'L';
    }
    // Neutrals: LTR only when surrounded by LTR, otherwise the paragraph (RTL) direction
    for (let i = 0; i < n; i++) {
      if (dir[i] !== 'N') continue;
      let j = i;
      while (j < n && dir[j] === 'N') j++;
      const before = i > 0 ? dir[i - 1] : 'R';
      const after = j < n ? dir[j] : 'R';
      const d = before === 'L' && after === 'L' ? 'L' : 'R';
      for (let k = i; k < j; k++) dir[k] = d;
      i = j - 1;
    }
    const out = [];
    let end = n;
    // Walk runs from the logical end: the last run is the leftmost on screen.
    while (end > 0) {
      let start = end - 1;
      while (start > 0 && dir[start - 1] === dir[end - 1]) start--;
      if (dir[start] === 'L') {
        for (let k = start; k < end; k++) out.push(chars[k]);
      } else {
        for (let k = end - 1; k >= start; k--) out.push(MIRROR[chars[k]] || chars[k]);
      }
      end = start;
    }
    return out;
  }

  function glyphOf(c) {
    return GLYPHS[c] || GLYPHS[c.toUpperCase()] || null;
  }

  function advance(c) {
    if (c === ' ') return SPACE_W + SPACING;
    const g = glyphOf(c);
    return g ? g.w + SPACING : 0;
  }

  /** Width in (unscaled) pixels. */
  function measure(str) {
    let w = 0;
    for (const c of String(str)) w += advance(c);
    return Math.max(0, w - SPACING);
  }

  // ---- string → canvas cache (text is static most of the time) ----
  const cache = new Map();
  const CACHE_MAX = 400;

  function renderToCanvas(str, color, scale, shadow) {
    const key = str + '\u0001' + color + '\u0001' + scale + '\u0001' + (shadow || '');
    let cv = cache.get(key);
    if (cv) return cv;
    const vis = visual(str);
    const w = measure(str);
    const sh = shadow ? 1 : 0;
    cv = document.createElement('canvas');
    cv.width = Math.max(1, (w + sh) * scale);
    cv.height = (LINE_H + sh) * scale;
    const g = cv.getContext('2d');
    const plot = (col, ox, oy) => {
      g.fillStyle = col;
      let x = 0;
      for (const c of vis) {
        const gl = c === ' ' ? null : glyphOf(c);
        if (gl) {
          for (let i = 0; i < gl.px.length; i += 2) {
            g.fillRect((x + gl.px[i] + ox) * scale, (gl.px[i + 1] + ASC + oy) * scale, scale, scale);
          }
        }
        x += advance(c);
      }
    };
    if (shadow) plot(shadow, 1, 1);
    plot(color, 0, 0);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, cv);
    return cv;
  }

  /**
   * Draw text. (x, y) is the anchor on the cap line.
   * opts: { color, scale=1, align='right'|'center'|'left', shadow }
   * Returns the drawn box {x, y, w, h} in canvas pixels.
   */
  function draw(ctx, str, x, y, opts) {
    const o = opts || {};
    const scale = o.scale || 1;
    const align = o.align || 'right';
    const cv = renderToCanvas(String(str), o.color || TP.PAL.white, scale, o.shadow);
    const w = measure(str) * scale;
    let left = x;
    if (align === 'right') left = x - w;
    else if (align === 'center') left = x - Math.floor(w / 2);
    left = Math.round(left);
    ctx.drawImage(cv, left, Math.round(y - ASC * scale));
    return { x: left, y: y, w: w, h: 7 * scale };
  }

  /** Greedy word wrap on logical text; returns an array of lines. */
  function wrap(str, maxW) {
    const out = [];
    for (const para of String(str).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (line && measure(test) > maxW) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  TP.Font = { draw, measure, wrap, visual, LINE_H, GLYPHS };
})(window.TP = window.TP || {});
