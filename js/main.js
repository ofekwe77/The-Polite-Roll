/* ==========================================================
   main.js — boot: canvas scaling, touch controls, audio
   unlock, auto-pause, accessibility announcements.
   ========================================================== */
(function (TP) {
  'use strict';

  const G = TP.game;
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const sr = document.getElementById('sr');
  const touchRoot = document.getElementById('touch');
  const btnL = document.getElementById('t-left');
  const btnR = document.getElementById('t-right');
  const btnJ = document.getElementById('t-jump');

  G.canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  G.touchMode = coarse;

  // ---------------- pixel-art icons for the touch buttons ----------------
  function icon(rows, label) {
    const S = TP.Sprites;
    const art = S.fromRows(rows, { '#': TP.PAL.white });
    const w = Math.max(art.width, label ? TP.Font.measure(label) : 0) + 4;
    const h = art.height + (label ? 12 : 4);
    const c = S.makeCanvas(w, h);
    const g = c.getContext('2d');
    g.drawImage(art, Math.floor((w - art.width) / 2), 2);
    if (label) TP.Font.draw(g, label, Math.floor(w / 2), art.height + 4, { color: TP.PAL.white, align: 'center' });
    c.className = 'ticon';
    return c;
  }
  const ARROW = ['....#......', '...##......', '..#########', '.##########', '###########', '.##########', '..#########', '...##......', '....#......'];
  btnL.appendChild(icon(ARROW));
  btnR.appendChild(icon(ARROW.map((r) => r.split('').reverse().join(''))));
  btnJ.appendChild(icon(['....#....', '...###...', '..#####..', '.#######.', '#########', '...###...', '...###...', '...###...'], 'קפיצה'));
  TP.Input.bindTouch(touchRoot, [
    { el: btnL, action: 'left' },
    { el: btnR, action: 'right' },
    { el: btnJ, action: 'jump' }
  ]);

  // ---------------- layout: keep 16:9, prefer whole-number scaling ----------------
  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const portrait = vh > vw * 1.1;
    document.body.classList.toggle('portrait', portrait);
    let availW = vw;
    let availH = vh;
    if (G.touchMode && portrait) availH = Math.max(vh * 0.5, vh - 240);
    let scale = Math.min(availW / TP.W, availH / TP.H);
    const whole = Math.floor(scale);
    if (whole >= 2 && whole / scale >= 0.86) scale = whole;   // crisp integer pixels when cheap
    canvas.style.width = Math.floor(TP.W * scale) + 'px';
    canvas.style.height = Math.floor(TP.H * scale) + 'px';
    // touch buttons scale with the screen, within finger-friendly limits
    const size = Math.round(Math.max(58, Math.min(92, Math.min(vw, vh) * 0.2)));
    document.documentElement.style.setProperty('--tbtn', size + 'px');
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));

  function refreshTouch() {
    document.body.classList.toggle('touch-mode', G.touchMode);
    document.body.classList.toggle('playing', G.state === 'play');
    if (G.state !== 'play') TP.Input.releaseTouch();
  }

  window.addEventListener('touchstart', () => {
    if (!G.touchMode) {
      G.touchMode = true;
      refreshTouch();
      layout();
    }
  }, { passive: true });

  // ---------------- audio only after a user gesture ----------------
  TP.Input.onFirstGesture = () => TP.Audio.unlock();
  window.addEventListener('pointerdown', () => TP.Audio.unlock(), { passive: true });
  window.addEventListener('touchend', () => TP.Audio.unlock(), { passive: true });

  // ---------------- screen reader announcements ----------------
  function announce(s) {
    const L = TP.LEVELS[G.li];
    const map = {
      title: 'גליל נייר התואלט המנומס. קפוץ מאסלה לאסלה והגע לכס החרסינה! לחצו Enter כדי להתחיל משחק.',
      help: 'הוראות המשחק.',
      select: 'בחירת שלב.',
      intro: 'שלב ' + (G.li + 1) + ': ' + (L ? L.name : ''),
      pause: 'עצירה. לחצו P כדי להמשיך.',
      complete: 'השלב הושלם!',
      gameover: 'נגמר הנייר! המשחק נגמר. ניקוד: ' + TP.Score.score,
      victory: 'איזה גליל מנומס! הצלחת להגיע לכס החרסינה! ניקוד סופי: ' + TP.Score.score
    };
    if (map[s] && sr) sr.textContent = map[s];
  }

  G.onState = (s) => {
    refreshTouch();
    announce(s);
  };

  // ---------------- auto-pause when the tab is hidden ----------------
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.actions.pause(); });
  window.addEventListener('blur', () => G.actions.pause());
  window.addEventListener('pagehide', () => G.actions.pause());

  // ---------------- no scrolling / zooming while playing ----------------
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (e.target === canvas || touchRoot.contains(e.target)) e.preventDefault(); });

  TP.UI.bindPointer(canvas);
  layout();
  refreshTouch();
  G.start(ctx);
})(window.TP);
