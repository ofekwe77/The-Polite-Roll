#!/usr/bin/env node
/* ==========================================================
   browser-test.js — optional end-to-end test in a real browser.

   Drives the actual game in headless Chrome/Edge: real key
   presses, touch events, menus, all five levels (replaying the
   solutions found by verify-levels.js through the game loop),
   death / game over / victory, pause, mute, high-score
   persistence and responsive layout.

   Setup (dev only — the game itself needs nothing):
     npm install --no-save puppeteer-core
     node tools/verify-levels.js --save      # writes tools/solutions.json
     node tools/browser-test.js [--shots]    # --shots saves screenshots
   Set CHROME_PATH if Chrome/Edge is not in a standard location.
   ========================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(__dirname, 'screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const c = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return c.find((p) => fs.existsSync(p));
}

let passed = 0;
let failed = 0;
function check(name, ok, info) {
  if (ok) { passed++; console.log('  PASS  ' + name + (info ? '  (' + info + ')' : '')); } else { failed++; console.log('  FAIL  ' + name + (info ? '  (' + info + ')' : '')); }
}

async function shot(page, name) {
  if (!SHOTS) return;
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
}

async function openPage(browser, viewport, errors) {
  const page = await browser.newPage();
  await page.setViewport(viewport || { width: 1280, height: 720 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(300);
  return page;
}

const state = (page) => page.evaluate(() => {
  const g = TP.game;
  const p = g.world && g.world.player;
  return {
    state: g.state, li: g.li, score: TP.Score.score, lives: TP.Score.lives, high: TP.Score.high,
    time: g.world ? g.world.time : 0,
    p: p ? { x: p.x, y: p.y, vx: p.vx, vy: p.vy, grounded: p.grounded, ground: p.ground, st: p.state } : null
  };
});

async function waitFor(page, fn, arg, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 5000)) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(50);
  }
  return false;
}

/**
 * In-page replay of a bot solution through the real game loop
 * (G.debug.simStep = the same per-step code the game runs every frame).
 * Runs actions[from, to); the real-time loop must be frozen meanwhile.
 */
function replayInPage(li, actions, from, to) {
  const G = TP.game;
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  const step = (inp) => G.debug.simStep(inp);
  const last = to == null ? actions.length : to;
  for (const a of actions.slice(from || 0, last)) {
    const preFrames = a.wait + a.pre;
    let frames = 0;
    const inputs = [];
    for (let i = 0; i < a.wait; i++) inputs.push(idle);
    const pr = { left: a.pdir < 0, right: a.pdir > 0, jumpHeld: false, jumpPressed: false };
    for (let i = 0; i < a.pre; i++) inputs.push(pr);
    for (let f = 0; f < 240; f++) {
      const d = f < a.steer ? a.jdir : 0;
      inputs.push({ left: d < 0, right: d > 0, jumpHeld: f < a.hold, jumpPressed: f === 0 });
    }
    let ended = false;
    for (const inp of inputs) {
      step(inp);
      frames++;
      if (G.world.completed) { ended = true; break; }
      if (G.world.player.state === 'dead') return { ok: false, why: 'died', li: li };
      if (frames > preFrames + 2 && G.world.player.grounded) break;
    }
    if (ended) break;
    for (let i = 0; i < 4; i++) step(idle);
  }
  if (last < actions.length) return { ok: true, partial: true };
  // let the victory bow play until the tally screen opens
  for (let i = 0; i < 400 && G.state === 'play'; i++) step(idle);
  return { ok: G.state === 'complete', state: G.state, score: TP.Score.score, lives: TP.Score.lives, taken: G.world.items.filter((i) => i.taken).length, items: G.world.items.length };
}

async function touchPoints(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id == null ? i : p.id })) });
}

async function main() {
  const exe = findBrowser();
  if (!exe) { console.error('No Chrome/Edge found. Set CHROME_PATH.'); process.exit(2); }
  const solPath = path.join(__dirname, 'solutions.json');
  if (!fs.existsSync(solPath)) { console.error('Run "node tools/verify-levels.js --save" first.'); process.exit(2); }
  const solutions = JSON.parse(fs.readFileSync(solPath, 'utf8'));
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];

  // -------------------------------------------------------------
  console.log('\n[1] Loading & main menu');
  let page = await openPage(browser, null, errors);
  let s = await state(page);
  check('game loads into the main menu', s.state === 'title', s.state);
  const meta = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title }));
  check('page is Hebrew RTL with the exact title', meta.lang === 'he' && meta.dir === 'rtl' && meta.title === 'גליל נייר התואלט המנומס', JSON.stringify(meta));
  await shot(page, '01-title');
  await page.keyboard.press('ArrowDown');
  await sleep(80);
  let idx = await page.evaluate(() => TP.UI.menus.title.index);
  check('arrow keys move the menu selection', idx === 1, 'index ' + idx);
  await page.keyboard.press('Enter');          // "הוראות"
  await sleep(120);
  s = await state(page);
  check('menu item opens the instructions screen', s.state === 'help', s.state);
  await shot(page, '02-help1');
  await page.keyboard.press('ArrowLeft');
  await sleep(100);
  await shot(page, '03-help2');
  await page.keyboard.press('Escape');
  await sleep(120);
  s = await state(page);
  check('Escape returns to the main menu', s.state === 'title', s.state);
  idx = await page.evaluate(() => TP.UI.menus.title.index);
  check('menu selection is back on "התחל משחק"', idx === 0, 'index ' + idx);
  await page.keyboard.press('Enter');          // "התחל משחק"
  await sleep(150);
  s = await state(page);
  check('"התחל משחק" starts level 1 (intro card)', s.state === 'intro' && s.li === 0, s.state + ' li=' + s.li);
  const audioState = await page.evaluate(() => TP.Audio.state);
  check('audio context created after the first key press', audioState === 'running' || audioState === 'suspended', audioState);
  await shot(page, '04-intro');
  await waitFor(page, () => TP.game.state === 'play', null, 4000);
  s = await state(page);
  check('intro leads into gameplay', s.state === 'play', s.state);

  // -------------------------------------------------------------
  console.log('\n[2] Movement, jumping, gravity, landing (real keyboard)');
  const x0 = s.p.x;
  await page.keyboard.down('ArrowRight');
  await sleep(150);
  await page.keyboard.up('ArrowRight');
  await sleep(150);
  s = await state(page);
  check('Right arrow moves the roll right', s.p.x > x0 + 4, x0.toFixed(1) + ' -> ' + s.p.x.toFixed(1));
  const x1 = s.p.x;
  await page.keyboard.down('KeyA');
  await sleep(120);
  await page.keyboard.up('KeyA');
  await sleep(150);
  s = await state(page);
  check('A key moves the roll left', s.p.x < x1 - 3, x1.toFixed(1) + ' -> ' + s.p.x.toFixed(1));
  const yGround = s.p.y;
  await page.keyboard.down('Space');
  await sleep(90);
  let sj = await state(page);
  check('Space makes the roll jump (moving up)', sj.p.vy < 0 && sj.p.y < yGround && !sj.p.grounded, 'vy=' + sj.p.vy.toFixed(0));
  await shot(page, '05-jump');
  await sleep(260);
  await page.keyboard.up('Space');
  let sa = await state(page);
  const peak = sa.p.y;
  await sleep(120);
  sa = await state(page);
  check('gravity pulls the roll back down', sa.p.vy > 0 || sa.p.grounded, 'vy=' + sa.p.vy.toFixed(0));
  await waitFor(page, () => TP.game.world.player.grounded, null, 2000);
  s = await state(page);
  check('the roll lands back on the toilet seat', s.p.grounded && Math.abs(s.p.y - yGround) < 0.01, 'y=' + s.p.y + ' peak=' + peak.toFixed(1));
  // no double jump: press jump twice quickly in the air
  await page.keyboard.press('Space');
  await sleep(110);
  const vyA = (await state(page)).p.vy;
  await page.keyboard.press('Space');
  await sleep(40);
  const vyB = (await state(page)).p.vy;
  check('no double jump in mid-air', vyB > vyA, 'vy ' + vyA.toFixed(0) + ' -> ' + vyB.toFixed(0));
  await waitFor(page, () => TP.game.world.player.grounded, null, 2000);

  // -------------------------------------------------------------
  console.log('\n[3] Pause & mute');
  await page.keyboard.press('KeyP');
  await sleep(100);
  const t1 = (await state(page)).time;
  await sleep(500);
  s = await state(page);
  check('P pauses the game and freezes the simulation', s.state === 'pause' && s.time === t1, 'time ' + t1.toFixed(3) + ' / ' + s.time.toFixed(3));
  await shot(page, '06-pause');
  await page.keyboard.press('KeyP');
  await sleep(250);
  s = await state(page);
  check('P resumes the game', s.state === 'play' && s.time > t1, s.state);
  await page.keyboard.press('KeyM');
  await sleep(60);
  let snd = await page.evaluate(() => TP.Audio.soundOn);
  check('M mutes the sound', snd === false);
  await page.keyboard.press('KeyM');
  await sleep(60);
  snd = await page.evaluate(() => TP.Audio.soundOn);
  check('M unmutes the sound', snd === true);

  // -------------------------------------------------------------
  console.log('\n[4] Falling costs exactly one life, then respawn');
  s = await state(page);
  const livesBefore = s.lives;
  await page.keyboard.down('ArrowLeft');
  const died = await waitFor(page, () => TP.game.world.player.state === 'dead', null, 4000);
  await page.keyboard.up('ArrowLeft');
  s = await state(page);
  check('walking off the toilet = falling into the darkness', died, s.p.st);
  check('exactly one life lost', s.lives === livesBefore - 1, livesBefore + ' -> ' + s.lives);
  await shot(page, '07-death');
  await waitFor(page, () => TP.game.world.player.state === 'play', null, 4000);
  s = await state(page);
  check('respawned at the level start, standing on the first toilet', s.p.st === 'play' && s.p.grounded && s.p.ground.t === 0, 'x=' + s.p.x);
  check('still exactly one life lost after respawn', s.lives === livesBefore - 1, String(s.lives));

  // -------------------------------------------------------------
  console.log('\n[5] Hazards & special toilets (real simulation)');
  const hz = await page.evaluate(() => {
    const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };
    const out = {};
    // water splash: stand on the first geyser toilet of level 3
    let w = TP.Sim.createWorld(2, null);
    let t = w.toilets[2];
    w.player.x = t.x + t.w / 2; w.player.y = t.y; w.player.ground = { t: 2, s: 'seat' };
    let n = 0;
    while (w.player.state === 'play' && n++ < 600) TP.Sim.step(w, idle, TP.STEP);
    out.water = w.player.cause;
    // soap slides into a player standing on its toilet
    w = TP.Sim.createWorld(2, null);
    t = w.toilets[6];
    w.player.x = t.x + t.w / 2; w.player.y = t.y; w.player.ground = { t: 6, s: 'seat' };
    n = 0;
    while (w.player.state === 'play' && n++ < 600) TP.Sim.step(w, idle, TP.STEP);
    out.soap = w.player.cause;
    // flying plunger in level 4
    w = TP.Sim.createWorld(3, null);
    const h = w.hazards[0];
    w.player.grounded = false; w.player.ground = null; w.player.x = h.x0; w.player.y = h.y0 + 6; w.player.vy = 0;
    TP.Sim.step(w, idle, TP.STEP);
    out.plunger = w.player.cause;
    // moving toilet carries the player
    w = TP.Sim.createWorld(3, null);
    t = w.toilets[2];
    w.player.x = t.x + t.w / 2; w.player.y = t.y; w.player.ground = { t: 2, s: 'seat' };
    const px0 = w.player.x, tx0 = t.x;
    for (let i = 0; i < 30; i++) TP.Sim.step(w, idle, TP.STEP);
    out.carry = { dp: w.player.x - px0, dt: t.x - tx0, grounded: w.player.grounded };
    // unstable toilet crumbles after landing, then rebuilds
    w = TP.Sim.createWorld(3, null);
    t = w.toilets[4];
    w.player.grounded = false; w.player.ground = null; w.player.x = t.x + t.w / 2; w.player.y = t.y - 4; w.player.vy = 50;
    const seen = [];
    for (let i = 0; i < 400; i++) { TP.Sim.step(w, idle, TP.STEP); if (seen[seen.length - 1] !== t.state) seen.push(t.state); }
    out.unstable = seen.join('>');
    out.unstableDeath = w.player.cause;
    // slippery toilet keeps you sliding
    w = TP.Sim.createWorld(2, null);
    t = w.toilets[12];
    w.player.x = t.x + 6; w.player.y = t.y; w.player.ground = { t: 12, s: 'seat' }; w.player.vx = 86;
    const sx0 = w.player.x;
    for (let i = 0; i < 20; i++) TP.Sim.step(w, idle, TP.STEP);
    out.slide = w.player.x - sx0;
    w = TP.Sim.createWorld(2, null);
    t = w.toilets[1];
    w.player.x = t.x + 6; w.player.y = t.y; w.player.ground = { t: 1, s: 'seat' }; w.player.vx = 86;
    const nx0 = w.player.x;
    for (let i = 0; i < 20; i++) TP.Sim.step(w, idle, TP.STEP);
    out.noSlide = w.player.x - nx0;
    return out;
  });
  check('water splash knocks the roll out', hz.water === 'water', hz.water);
  check('sliding soap knocks the roll out', hz.soap === 'soap', hz.soap);
  check('flying plunger knocks the roll out', hz.plunger === 'plunger', hz.plunger);
  check('moving toilet carries the roll along', Math.abs(hz.carry.dp - hz.carry.dt) < 0.01 && Math.abs(hz.carry.dt) > 1 && hz.carry.grounded, JSON.stringify(hz.carry));
  check('cracked toilet shakes, falls and is rebuilt', hz.unstable === 'idle>shake>fall>gone>idle', hz.unstable + ' / player: ' + hz.unstableDeath);
  check('slippery toilet has low traction', hz.slide > hz.noSlide * 1.5, 'slide ' + hz.slide.toFixed(1) + ' vs ' + hz.noSlide.toFixed(1));

  // -------------------------------------------------------------
  console.log('\n[6] All five levels, played through the real game loop');
  // Freeze the real-time loop for this section: every simulation step comes
  // from the recorded inputs, so timing-sensitive levels replay exactly.
  await page.evaluate(() => { TP.game.debugFreeze = true; TP.Score.reset(); TP.game.debug.startLevel(0); TP.game.debug.beginPlay(); });
  let victory = false;
  for (let li = 0; li < 5; li++) {
    const sol = solutions[li];
    if (!sol) { check('solution for level ' + (li + 1), false, 'missing'); break; }
    const before = await state(page);
    let r;
    if (li >= 1) {
      // stop half-way for an in-game screenshot, then finish the level
      const half = Math.floor(sol.length / 2);
      await page.evaluate(replayInPage, li, sol, 0, half);
      await page.evaluate(() => TP.game.debug.render());
      await shot(page, '10-play-L' + (li + 1));
      r = await page.evaluate(replayInPage, li, sol, half, null);
    } else {
      r = await page.evaluate(replayInPage, li, sol, 0, null);
    }
    check('level ' + (li + 1) + ' completed', r.ok, JSON.stringify(r));
    check('level ' + (li + 1) + ' added points (items/landings/bonus)', r.score > before.score, before.score + ' -> ' + r.score);
    await sleep(2000);                    // let the tally count up like a player would watch it
    if (li === 0 || li === 4) await shot(page, '08-complete-L' + (li + 1));
    const tallyDone = await page.evaluate(() => TP.game.tally && TP.game.tally.done);
    check('level ' + (li + 1) + ' tally screen finished counting', tallyDone === true);
    await page.keyboard.press('Enter');   // continue
    await waitFor(page, () => TP.game.state !== 'complete', null, 2000);
    s = await state(page);
    if (li < 4) {
      check('advances to level ' + (li + 2), s.state === 'intro' && s.li === li + 1, s.state + ' li=' + s.li);
      if (li === 2) await shot(page, '09-intro-L4');
      await page.evaluate(() => { if (TP.game.state === 'intro') TP.game.debug.beginPlay(); });
    } else {
      victory = s.state === 'victory';
      check('final victory screen after level 5', victory, s.state);
      await sleep(1500);
      await shot(page, '11-victory');
    }
  }
  await page.evaluate(() => { TP.game.debugFreeze = false; });
  const finalScore = (await state(page)).score;
  const finalHigh = (await state(page)).high;
  check('high score updated', finalHigh >= finalScore && finalHigh > 0, 'score ' + finalScore + ' high ' + finalHigh);

  // -------------------------------------------------------------
  console.log('\n[7] High score survives a page refresh');
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  const highAfter = await page.evaluate(() => TP.Score.high);
  check('high score persisted in localStorage', highAfter === finalHigh, finalHigh + ' -> ' + highAfter);
  const reached = await page.evaluate(() => TP.Score.reached);
  check('level select unlocked (furthest level remembered)', reached === 4, String(reached));

  // -------------------------------------------------------------
  console.log('\n[8] Game over & restart');
  await page.evaluate(() => { TP.Score.reset(); TP.game.debug.startLevel(1); TP.game.debug.beginPlay(); });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const G = TP.game; G.debugFreeze = true;
      const left = { left: true, right: false, jumpHeld: false, jumpPressed: false };
      for (let k = 0; k < 600 && G.world.player.state === 'play'; k++) G.debug.simStep(left);
      for (let k = 0; k < 200 && G.state === 'play' && G.world.player.state === 'dead'; k++) G.debug.simStep(left);
      G.debugFreeze = false;
    });
  }
  s = await state(page);
  check('losing the last life shows the game over screen', s.state === 'gameover' && s.lives === 0, s.state + ' lives=' + s.lives);
  await sleep(1100);
  await shot(page, '12-gameover');
  await page.keyboard.press('Enter');     // "משחק חדש"
  await sleep(150);
  s = await state(page);
  check('"משחק חדש" resets score, lives and level', s.state === 'intro' && s.li === 0 && s.score === 0 && s.lives === 3, JSON.stringify({ st: s.state, li: s.li, sc: s.score, l: s.lives }));
  // restart level keeps lives, restores score
  await page.evaluate(() => TP.game.debug.beginPlay());
  await page.keyboard.down('ArrowRight');
  await sleep(250);
  await page.keyboard.down('Space');
  await sleep(300);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  await sleep(600);
  const scBefore = (await state(page)).score;
  await page.keyboard.press('KeyR');
  await sleep(150);
  s = await state(page);
  check('R restarts the level (score from this attempt removed, lives kept)', s.state === 'intro' && s.score === 0 && s.lives === 3, 'score before ' + scBefore + ' after ' + s.score);
  await page.close();

  // -------------------------------------------------------------
  console.log('\n[9] Mobile: touch controls (emulated phone, landscape)');
  const phone = { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true };
  page = await openPage(browser, phone, errors);
  const cdp = await page.target().createCDPSession();
  const tapMenu = await page.evaluate(() => {
    const c = document.getElementById('screen').getBoundingClientRect();
    return { x: c.left + (200 / 320) * c.width, y: c.top + (80 / 180) * c.height };
  });
  await touchPoints(cdp, 'touchStart', [tapMenu]);
  await touchPoints(cdp, 'touchEnd', []);
  await sleep(200);
  s = await state(page);
  check('tapping "התחל משחק" on the canvas starts the game', s.state === 'intro', s.state);
  const tm = await page.evaluate(() => TP.game.touchMode);
  check('touch mode detected', tm === true);
  await page.evaluate(() => TP.game.debug.beginPlay());
  await sleep(150);
  const vis = await page.evaluate(() => getComputedStyle(document.getElementById('touch')).display !== 'none');
  check('touch buttons visible during play', vis);
  await shot(page, '13-mobile-play');
  const rect = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  const bR = await rect('t-right');
  const bJ = await rect('t-jump');
  s = await state(page);
  const mx0 = s.p.x;
  await touchPoints(cdp, 'touchStart', [{ x: bR.x, y: bR.y, id: 1 }]);
  await sleep(160);
  s = await state(page);
  check('holding the ▶ button moves right', s.p.x > mx0 + 4, mx0.toFixed(1) + ' -> ' + s.p.x.toFixed(1));
  await touchPoints(cdp, 'touchStart', [{ x: bR.x, y: bR.y, id: 1 }, { x: bJ.x, y: bJ.y, id: 2 }]);
  await sleep(90);
  s = await state(page);
  check('▶ + jump at the same time (multi-touch) = running jump', !s.p.grounded && s.p.vy < 0 && s.p.vx > 0, 'vx=' + s.p.vx.toFixed(0) + ' vy=' + s.p.vy.toFixed(0));
  await touchPoints(cdp, 'touchEnd', []);
  await sleep(100);
  const covered = await page.evaluate(() => {
    const c = document.getElementById('screen').getBoundingClientRect();
    const ids = ['t-left', 't-right', 't-jump'];
    // buttons must not cover the middle band where toilets and the roll live (y 25%..72%)
    return ids.map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top > c.top + c.height * 0.72 || r.right < c.left || r.left > c.right; });
  });
  check('touch buttons stay clear of the main play band', covered.every(Boolean), JSON.stringify(covered));
  // pause via the on-canvas pause button
  const pz = await page.evaluate(() => { const c = document.getElementById('screen').getBoundingClientRect(); return { x: c.left + (8 / 320) * c.width, y: c.top + (5 / 180) * c.height }; });
  await touchPoints(cdp, 'touchStart', [pz]);
  await touchPoints(cdp, 'touchEnd', []);
  await sleep(150);
  s = await state(page);
  check('on-screen pause button pauses the game', s.state === 'pause', s.state);
  await shot(page, '14-mobile-pause');
  await page.close();

  // portrait phone
  page = await openPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, errors);
  await page.evaluate(() => { TP.game.touchMode = true; window.dispatchEvent(new Event('resize')); TP.Score.reset(); TP.game.debug.startLevel(0); TP.game.debug.beginPlay(); });
  await sleep(200);
  const portrait = await page.evaluate(() => {
    const c = document.getElementById('screen').getBoundingClientRect();
    const b = document.getElementById('t-jump').getBoundingClientRect();
    return { canvasBottom: c.bottom, buttonTop: b.top, w: c.width, h: c.height };
  });
  check('portrait: game on top, buttons below (no overlap)', portrait.canvasBottom <= portrait.buttonTop, JSON.stringify(portrait));
  await shot(page, '15-mobile-portrait');
  await page.close();

  // -------------------------------------------------------------
  console.log('\n[10] Responsive layout at different screen sizes');
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 800, height: 600 }, { width: 640, height: 360 }]) {
    page = await openPage(browser, vp, errors);
    const r = await page.evaluate(() => { const c = document.getElementById('screen').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, t: c.top, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }; });
    const fits = r.w <= vp.width && r.h <= vp.height && r.l >= 0 && r.t >= 0 && r.sw <= vp.width && r.sh <= vp.height;
    const ratio = Math.abs(r.w / r.h - 16 / 9) < 0.02;
    check(vp.width + 'x' + vp.height + ': canvas fits, 16:9, no scrollbars', fits && ratio, Math.round(r.w) + 'x' + Math.round(r.h));
    await page.close();
  }

  await browser.close();
  console.log('\nJavaScript errors during the whole run: ' + errors.length);
  errors.slice(0, 10).forEach((e) => console.log('   ' + e));
  if (errors.length) failed++;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
