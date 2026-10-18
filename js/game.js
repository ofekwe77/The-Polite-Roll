/* ==========================================================
   game.js — state machine, fixed-timestep loop, scoring,
   lives, effects and the polite personality.

   States: title · help · select · intro · play · pause ·
           complete · gameover · victory
   ========================================================== */
(function (TP) {
  'use strict';

  const W = TP.W;
  const STEP = TP.STEP;
  const P = TP.PAL;
  const Input = TP.Input;
  const Audio = TP.Audio;
  const Sim = TP.Sim;
  const Score = TP.Score;
  const UI = TP.UI;
  const R = TP.Renderer;

  // ---------------- the roll's polite vocabulary ----------------
  const MSG = {
    land: ['תודה!', 'בבקשה!', 'סליחה!', 'איזה יופי!', 'יום נפלא!', 'סליחה, אפשר לעבור?', 'נחיתה מכובדת!',
           'איזה שירותים מפוארים!', 'תודה רבה!', 'מקסים!', 'אחריכם, בבקשה!', 'נעים מאוד!'],
    start: ['שלום!', 'בהצלחה לי!', 'נעים מאוד!', 'יוצאים לדרך, בנימוס!'],
    respawn: ['ננסה שוב, בנימוס!', 'סליחה, שוב אני!', 'עוד ניסיון, בבקשה!', 'לא נורא, ממשיכים!'],
    win: ['תודה על האירוח!', 'איזה שירותים מפוארים!', 'נחיתה מכובדת!', 'כס של מלכים!'],
    quip: ['תודה על האירוח!', 'איזה שירותים מפוארים!', 'נחיתה מכובדת!', 'גליל אחד, המון נימוס!', 'סליחה שהתעכבתי!'],
    death: {
      fall: ['אוי, לא נעים!', 'סליחה על ההפרעה!', 'אופס! סליחה!', 'נפלתי, תודה ששאלתם!'],
      water: ['אוי, נרטבתי!', 'רטוב! לא נעים!', 'מים? על נייר?!'],
      plunger: ['פומפה?! לא מנומס!', 'איי! סליחה!', 'אוי, פומפה!'],
      soap: ['סבון! איזה חלקלק!', 'אוי, סבון!', 'החלקתי, סליחה!']
    }
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const G = {
    state: 'boot',
    stateT: 0,
    clock: 0,
    dtFrame: 0,
    li: 0,
    world: null,
    cam: { x: 0, look: 0 },
    fx: { parts: [], pops: [], speech: null, shake: 0 },
    persist: { taken: [] },
    landed: {},
    deaths: 0,
    levelStartScore: 0,
    deathResolved: false,
    tally: null,
    helpPage: 0,
    touchMode: false,
    canFullscreen: false,
    lastTalk: -10,
    seen: {},
    acc: 0,
    last: 0,
    ctx: null,
    actions: {},
    onState: null,     // hook set by main.js (touch UI, a11y)
    paused: false
  };

  // ---------------------------------------------------------
  // State changes
  // ---------------------------------------------------------
  function setState(s) {
    G.state = s;
    G.stateT = 0;
    Input.clearPresses();
    if (G.onState) G.onState(s);
  }

  function spawn() {
    G.world = Sim.createWorld(G.li, G.persist);
    G.fx.parts.length = 0;
    G.fx.pops.length = 0;
    G.fx.speech = null;
    G.fx.shake = 0;
    G.deathResolved = false;
    G.acc = 0;
    snapCamera();
    R.prepareStars(G.li + 1, G.world.width);
  }

  function startLevel(li) {
    G.li = li;
    G.persist = { taken: [] };
    G.landed = {};
    G.deaths = 0;
    G.levelStartScore = Score.score;
    G.seen = {};
    Score.markReached(li);
    spawn();
    Audio.stopMusic();
    setState('intro');
    Audio.play('start');
  }

  function beginPlay() {
    setState('play');
    Audio.startMusic(G.li === TP.LEVELS.length - 1 ? 2 : 1);
    say(pick(MSG.start), true);
  }

  function restartLevel() {
    Score.setScore(G.levelStartScore);
    startLevel(G.li);
  }

  G.actions = {
    newGame(li) { Score.reset(); startLevel(li || 0); },
    go(s) {
      if (s === 'title') { Audio.startMusic(0); UI.resetMenu('title'); }
      if (s === 'help') G.helpPage = 0;
      if (s === 'select') UI.resetMenu('select');
      setState(s);
    },
    toggleSound() { Audio.toggleSound(); },
    toggleMusic() { Audio.setMusic(!Audio.musicOn); },
    fullscreen() { toggleFullscreen(); },
    pause() {
      if (G.state !== 'play') return;
      setState('pause');
      UI.resetMenu('pause');
      Audio.play('pause');
      Audio.holdMusic(true);
    },
    resume() {
      if (G.state !== 'pause') return;
      setState('play');
      Audio.holdMusic(false);
    },
    restartLevel() { restartLevel(); },
    continueLevel() { Score.reset(); startLevel(G.li); },
    skipIntro() { if (G.state === 'intro' && G.stateT > 0.25) beginPlay(); },
    confirmComplete() { if (G.state === 'complete' && G.stateT > 0.4) confirmComplete(); }
  };

  // ---------------------------------------------------------
  // Effects
  // ---------------------------------------------------------
  function say(text, force, anchor) {
    const sp = G.fx.speech;
    if (!force && sp && sp.t < sp.dur) return;
    G.fx.speech = { text: text, t: 0, dur: Math.max(1.4, 0.6 + text.length * 0.07), anchor: anchor || null };
    G.lastTalk = G.clock;
    Audio.play('talk');
  }

  function pop(text, x, y, color) {
    G.fx.pops.push({ text: text, x: x, y: y, color: color || P.white, t: 0, dur: 1.1 });
  }

  function burst(x, y, n, colors, speed, life, grav, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      G.fx.parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
        t: 0, life: life * (0.6 + Math.random() * 0.4), g: grav, c: colors[i % colors.length], s: size || 1
      });
    }
  }

  function addScore(n, x, y, color, label) {
    if (Score.add(n)) {
      Audio.play('extraLife');
      pop('+1 חיים!', x, y - 12, P.pink);
    }
    if (label !== false) pop(label || '+' + n, x, y, color);
  }

  function onScreen(x) {
    return x > G.cam.x - 40 && x < G.cam.x + W + 40;
  }

  // ---------------------------------------------------------
  // Simulation events → score, sound, personality
  // ---------------------------------------------------------
  function onEvent(e) {
    const w = G.world;
    switch (e.type) {
      case 'jump':
        Audio.play('jump');
        burst(e.x, e.y, 3, [P.light, P.grey], 18, 0.3, 40);
        break;
      case 'land': {
        Audio.play('land');
        burst(e.x, e.y, 4, [P.white, P.light], 22, 0.3, 60);
        const t = w.toilets[e.t];
        if (G.landed[e.t]) break;
        G.landed[e.t] = true;
        if (t.type === 'golden') break;
        addScore(TP.SCORE.land, e.x, e.y - 22, P.white);
        if (e.perfect) {
          addScore(TP.SCORE.perfect, e.x, e.y - 34, P.green, '+100 נימוסים!');
          Audio.play('perfect');
          burst(e.x, e.y - 6, 10, [P.yellow, P.white], 40, 0.6, 30);
          say('נחיתה מנומסת!', true);
        } else if (t.type === 'slippery' && !G.seen.slip) {
          G.seen.slip = true;
          say('זהירות, רטוב!', true);
        } else if (t.type === 'moving' && !G.seen.move) {
          G.seen.move = true;
          say('וואו, היא זזה!', true);
        } else if (G.clock - G.lastTalk > 5 && Math.random() < 0.35) {
          say(pick(MSG.land));
        }
        break;
      }
      case 'collect': {
        const pts = e.k === 'star' ? TP.SCORE.star : TP.SCORE.item;
        const col = e.k === 'bubble' ? P.cyan : P.yellow;
        addScore(pts, e.x, e.y - 6, col);
        Audio.play(e.k === 'star' ? 'star' : e.k === 'bubble' ? 'bubble' : 'collect');
        burst(e.x, e.y, e.k === 'star' ? 12 : 7, e.k === 'bubble' ? [P.cyan, P.white] : [P.yellow, P.white, P.gold], 34, 0.5, 20);
        if (e.k === 'star' && Math.random() < 0.6) say('כוכב! תודה רבה!');
        break;
      }
      case 'death': {
        Score.loseLife();
        G.deaths++;
        Audio.play(e.cause === 'fall' ? 'fall' : 'hurt');
        if (e.cause === 'water') Audio.play('splash');
        if (e.cause !== 'fall') {
          G.fx.shake = 0.3;
          burst(e.x, e.y - 8, 14, [P.white, P.cream, P.light], 60, 0.9, 120, 2);
        }
        const msgs = MSG.death[e.cause] || MSG.death.fall;
        const ay = Math.min(e.y, TP.H - 30);
        say(pick(msgs), true, { x: e.x, y: ay });
        break;
      }
      case 'complete': {
        Audio.stopMusic();
        Audio.play('levelDone');
        say(pick(MSG.win), true);
        const t = w.toilets[e.t];
        burst(t.x + t.w / 2, t.y - 10, 24, [P.yellow, P.white, P.gold, P.cyan], 70, 1.0, 50);
        Score.markReached(Math.min(G.li + 1, TP.LEVELS.length - 1));
        break;
      }
      case 'crack':
        Audio.play('crack');
        if (!G.seen.crack) { G.seen.crack = true; say('אוי, זה סדוק!', true); }
        break;
      case 'crumble': {
        Audio.play('crumble');
        const t = w.toilets[e.t];
        burst(t.x + t.w / 2, t.y + 6, 16, [P.light, P.grey, P.dimGrey], 50, 0.8, 200, 2);
        break;
      }
      case 'rebuild': {
        const t = w.toilets[e.t];
        if (onScreen(t.x)) Audio.play('rebuild');
        break;
      }
      case 'splashWarn': {
        const t = w.toilets[e.t];
        if (onScreen(t.x)) Audio.play('gurgle');
        break;
      }
      case 'splash': {
        const t = w.toilets[e.t];
        if (onScreen(t.x)) {
          Audio.play('splash');
          burst(t.x + t.w / 2, t.y - 30, 10, [P.cyan, P.white, P.water], 50, 0.7, 160);
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------
  // Per-step game logic
  // ---------------------------------------------------------
  function readInput() {
    return {
      left: Input.isDown('left'),
      right: Input.isDown('right'),
      jumpHeld: Input.isDown('jump'),
      jumpPressed: Input.take('jump')
    };
  }

  function simStep(input) {
    const w = G.world;
    Sim.step(w, input || readInput(), STEP);
    for (const e of w.events) onEvent(e);
    const p = w.player;
    if (p.state === 'dead' && !G.deathResolved && p.deadT > 1.8) {
      G.deathResolved = true;
      afterDeath();
      return;
    }
    if (w.completed && G.state === 'play' && p.winT > 2.2) enterComplete();
    updateCamera(STEP);
  }

  function afterDeath() {
    // keep collected items collected
    G.persist.taken = G.world.items.filter((i) => i.taken).map((i) => i.id);
    if (Score.lives > 0) {
      spawn();
      say(Score.lives === 1 ? 'זהירות, אין נייר!' : pick(MSG.respawn), true);
    } else {
      Audio.stopMusic();
      Audio.play('gameOver');
      UI.resetMenu('gameover');
      setState('gameover');
    }
  }

  function enterComplete() {
    const w = G.world;
    const total = w.items.length;
    const got = w.items.filter((i) => i.taken).length;
    G.tally = {
      quip: pick(MSG.quip),
      lines: [
        { label: 'בונוס סיום שלב', value: TP.SCORE.level, ok: true },
        { label: 'בלי לאבד חיים', value: TP.SCORE.noDeath, ok: G.deaths === 0 },
        { label: 'כל הפריטים (' + got + '/' + total + ')', value: TP.SCORE.allItems, ok: got === total }
      ],
      shown: 0,
      timer: 0,
      done: false
    };
    setState('complete');
  }

  function revealTally() {
    const tl = G.tally;
    const ln = tl.lines[tl.shown];
    tl.shown++;
    if (ln.ok) {
      addScore(ln.value, 0, 0, null, false);
      Audio.play('collect');
    } else {
      Audio.play('tick');
    }
    if (tl.shown >= tl.lines.length) tl.done = true;
  }

  function confirmComplete() {
    const tl = G.tally;
    if (!tl) return;
    if (!tl.done) {
      while (!tl.done) revealTally();
      return;
    }
    if (G.li >= TP.LEVELS.length - 1) {
      Audio.stopMusic();
      Audio.play('victory');
      UI.resetMenu('victory');
      setState('victory');
    } else {
      startLevel(G.li + 1);
    }
  }

  // ---------------------------------------------------------
  // Camera
  // ---------------------------------------------------------
  function camTarget() {
    const p = G.world.player;
    const t = p.x - W * 0.42 + G.cam.look;
    return Math.max(0, Math.min(G.world.width - W, t));
  }

  function snapCamera() {
    G.cam.look = 0;
    G.cam.x = camTarget();
  }

  function updateCamera(dt) {
    const p = G.world.player;
    if (p.state === 'dead') return;
    const look = p.state === 'play' ? p.facing * 26 : 0;
    G.cam.look += (look - G.cam.look) * Math.min(1, dt * 2.2);
    G.cam.x += (camTarget() - G.cam.x) * Math.min(1, dt * 5);
  }

  // ---------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------
  function toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) return;
        const r = req.call(el);
        const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } };
        if (r && r.then) r.then(lock).catch(() => {}); else lock();
      } else {
        const ex = d.exitFullscreen || d.webkitExitFullscreen;
        if (ex) ex.call(d);
      }
    } catch (e) { /* fullscreen not allowed */ }
  }

  // ---------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------
  function updateEffects(dt) {
    const fx = G.fx;
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i];
      p.t += dt;
      if (p.t >= p.life) { fx.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = fx.pops.length - 1; i >= 0; i--) {
      fx.pops[i].t += dt;
      if (fx.pops[i].t >= fx.pops[i].dur) fx.pops.splice(i, 1);
    }
    if (fx.speech) {
      fx.speech.t += dt;
      if (fx.speech.t >= fx.speech.dur) fx.speech = null;
    }
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt);
  }

  function runSim(dt) {
    G.acc += dt;
    let n = 0;
    while (G.acc >= STEP && n < 6) {
      simStep();
      G.acc -= STEP;
      n++;
      if (G.state !== 'play' && G.state !== 'complete') break;
    }
    if (n >= 6) G.acc = 0;
  }

  function update(dt) {
    G.clock += dt;
    G.stateT += dt;
    if (Input.take('mute')) Audio.toggleSound();
    if (Input.take('fullscreen')) toggleFullscreen();

    switch (G.state) {
      case 'title':
        UI.updateMenus();
        break;
      case 'help':
        if (Input.take('left') || Input.take('right')) { G.helpPage = 1 - G.helpPage; Audio.play('menuMove'); }
        if (Input.take('confirm')) {
          Audio.play('menuSelect');
          if (G.helpPage === 0) G.helpPage = 1; else G.actions.go('title');
        }
        if (Input.take('back')) G.actions.go('title');
        break;
      case 'select':
        UI.updateMenus();
        if (Input.take('back')) G.actions.go('title');
        break;
      case 'intro': {
        const go = Input.take('confirm') | Input.take('jump');
        if ((go && G.stateT > 0.25) || G.stateT > 2.8) beginPlay();
        break;
      }
      case 'play': {
        const p = G.world.player;
        if (Input.take('pause')) { G.actions.pause(); break; }
        if (Input.take('restart') && p.state === 'play') { restartLevel(); break; }
        if (!G.debugFreeze) runSim(dt);
        updateEffects(dt);
        break;
      }
      case 'pause':
        if (Input.take('pause')) { G.actions.resume(); break; }
        if (Input.take('restart')) { restartLevel(); break; }
        UI.updateMenus();
        break;
      case 'complete': {
        const tl = G.tally;
        tl.timer += dt;
        if (!tl.done && tl.timer > 0.55 * (tl.shown + 1)) revealTally();
        // presses during the first moment are discarded, so mashing can't skip the tally
        const go = Input.take('confirm') | Input.take('jump');
        if (go && G.stateT > 0.4) confirmComplete();
        if (!G.debugFreeze) runSim(dt);
        updateEffects(dt);
        break;
      }
      case 'gameover':
      case 'victory':
        UI.updateMenus();
        break;
      default:
        break;
    }
  }

  function render() {
    const ctx = G.ctx;
    UI.beginFrame();
    ctx.save();
    switch (G.state) {
      case 'title': UI.drawTitle(ctx); break;
      case 'help': UI.drawHelp(ctx); break;
      case 'select': UI.drawSelect(ctx); break;
      case 'intro': UI.drawIntro(ctx); break;
      case 'play':
      case 'pause':
      case 'complete':
        if (G.fx.shake > 0 && G.state === 'play') ctx.translate(Math.round(Math.random() * 4 - 2), Math.round(Math.random() * 2 - 1));
        R.world(ctx, G);
        ctx.restore();
        ctx.save();
        UI.drawHUD(ctx);
        if (G.state === 'pause') UI.drawPause(ctx);
        if (G.state === 'complete') UI.drawComplete(ctx);
        break;
      case 'gameover': UI.drawGameOver(ctx); break;
      case 'victory': UI.drawVictory(ctx, G.dtFrame); break;
      default: break;
    }
    ctx.restore();
    UI.endFrame();
  }

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - G.last) / 1000));
    G.last = now;
    G.dtFrame = dt;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function start(ctx) {
    G.ctx = ctx;
    UI.init(G);
    G.actions.go('title');
    G.last = performance.now();
    requestAnimationFrame(frame);
  }

  // Hooks used by the automated browser tests (tools/browser-test.js).
  G.debug = {
    simStep: simStep,
    startLevel: startLevel,
    beginPlay: beginPlay,
    update: update,
    render: render,
    enterComplete: enterComplete
  };

  G.start = start;
  G.setState = setState;
  G.toggleFullscreen = toggleFullscreen;
  TP.game = G;
})(window.TP = window.TP || {});
