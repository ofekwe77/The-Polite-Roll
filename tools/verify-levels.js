#!/usr/bin/env node
/* ==========================================================
   verify-levels.js — proves every level can be completed.

   Loads the game's real simulation (js/config.js, js/levels.js,
   js/sim.js) into a Node VM and runs a search bot that plays
   each level with plain keyboard-style inputs: wait, run, jump
   (with variable hold time) and air steering. The bot uses
   exactly the same physics as the game, so a found solution is
   a genuine playthrough.

   Usage:
     node tools/verify-levels.js            # all levels
     node tools/verify-levels.js 3          # only level 3
     node tools/verify-levels.js --forgiveness   # also measure each jump's
                                                 # timing window (frames)
     node tools/verify-levels.js --save     # write tools/solutions.json

   No dependencies. Exit code 1 if any level is not completable.
   ========================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DT = 1 / 60;

function loadTP() {
  const ctx = { console: console, Math: Math };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['js/config.js', 'js/levels.js', 'js/sim.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.TP;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * An action is a short input script:
 *   wait  frames standing still
 *   pdir/pre  run in a direction for some frames (positioning / run-up)
 *   jdir  direction held while jumping
 *   hold  frames the jump button is held (variable jump height)
 *   steer frames the direction is held in the air, then released
 */
function* actionInputs(a) {
  const n = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  for (let i = 0; i < a.wait; i++) yield n;
  const pr = { left: a.pdir < 0, right: a.pdir > 0, jumpHeld: false, jumpPressed: false };
  for (let i = 0; i < a.pre; i++) yield pr;
  for (let f = 0; f < 240; f++) {
    const d = f < a.steer ? a.jdir : 0;
    yield { left: d < 0, right: d > 0, jumpHeld: f < a.hold, jumpPressed: f === 0 };
  }
}

/** Run one action from world w0. */
function run(TP, w0, a) {
  const w = clone(w0);
  const startRef = w.player.ground ? w.player.ground.t : -1;
  let jumped = false;
  let frames = 0;
  const preFrames = a.wait + a.pre;
  for (const inp of actionInputs(a)) {
    TP.Sim.step(w, inp, DT);
    frames++;
    if (w.events.some((e) => e.type === 'jump')) jumped = true;
    if (w.completed) return { w, complete: true, frames };
    if (w.player.state === 'dead') return { w, dead: true, frames };
    if (frames > preFrames + 2 && w.player.grounded) break;
  }
  if (!w.player.grounded || !jumped) return { w, frames };
  // Settle for a few frames so we only accept stable landings.
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  for (let i = 0; i < 4; i++) {
    TP.Sim.step(w, idle, DT);
    frames++;
    if (w.player.state === 'dead') return { w, dead: true, frames };
  }
  if (!w.player.grounded) return { w, frames };
  return { w, landed: w.player.ground, from: startRef, frames };
}

function searchActions() {
  const out = [];
  const waits = [0, 15, 30, 45, 60, 80, 100, 130];
  const pres = [[0, 0], [1, 5], [1, 12], [1, 22], [-1, 6], [-1, 14]];
  const jdirs = [1, 0];
  const holds = [6, 12, 99];
  const steers = [99, 10, 20];
  for (const wait of waits) for (const [pdir, pre] of pres) for (const jdir of jdirs)
    for (const hold of holds) for (const steer of steers) out.push({ wait, pdir, pre, jdir, hold, steer });
  return out;
}

function solve(TP, li) {
  const w0 = TP.Sim.createWorld(li, null);
  const actions = searchActions();
  const open = [{ w: w0, path: [], prog: w0.toilets[w0.player.ground.t].x, depth: 0 }];
  const seen = new Set();
  let expanded = 0;
  const MAX = 400;
  while (open.length && expanded < MAX) {
    open.sort((a, b) => (a.prog - b.prog) || (b.depth - a.depth));
    const node = open.pop();
    expanded++;
    const here = node.w.player.ground.t;
    for (const a of actions) {
      const r = run(TP, node.w, a);
      if (r.complete) return { ok: true, path: node.path.concat([a]), expanded };
      if (!r.landed || r.landed.t === here) continue;
      const t = r.w.toilets[r.landed.t];
      const key = r.landed.t + '|' + r.landed.s + '|' + Math.round(r.w.player.x / 6) + '|' + Math.round((r.w.time % 30) * 4);
      if (seen.has(key)) continue;
      seen.add(key);
      open.push({ w: r.w, path: node.path.concat([a]), prog: t.baseX, depth: node.depth + 1 });
    }
  }
  return { ok: false, expanded };
}

/** Replays a solution, returning the list of landings (toilet ids). */
function replay(TP, li, path) {
  let w = TP.Sim.createWorld(li, null);
  const steps = [];
  for (const a of path) {
    const before = clone(w);
    const r = run(TP, w, a);
    steps.push({ from: w.player.ground ? w.player.ground.t : -1, to: r.complete ? 'GOLD' : r.landed && r.landed.t, before, a, r });
    w = r.w;
    if (r.complete) break;
  }
  return { steps, complete: w.completed };
}

/**
 * Jump-timing window: from the state before each jump (with the
 * solution's wait kept, so moving parts are in the same phase), the
 * player runs right and presses jump on frame k. Frame k counts as
 * "good" if some reasonable hold/steer combination reaches the same
 * toilet alive. Returns the number of good frames (60 = one second).
 */
function timingWindow(TP, step) {
  const target = step.to;
  const hit = (r) => (target === 'GOLD' ? r.complete : (r.landed && r.landed.t === target));
  let good = 0;
  for (let k = 0; k <= 60; k++) {
    let any = false;
    for (const hold of [6, 10, 14, 20, 99]) {
      for (const steer of [8, 14, 20, 28, 99]) {
        if (hit(run(TP, step.before, { wait: step.a.wait, pdir: 1, pre: k, jdir: 1, hold, steer }))) { any = true; break; }
      }
      if (any) break;
    }
    if (any) good++;
  }
  return good;
}

function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const wantF = args.includes('--forgiveness');
  const save = args.includes('--save');
  const TP = loadTP();
  const solutions = {};
  let allOk = true;
  TP.LEVELS.forEach((lv, li) => {
    if (only.length && !only.includes(li + 1)) return;
    const t0 = Date.now();
    const res = solve(TP, li);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (!res.ok) {
      allOk = false;
      console.log(`Level ${li + 1} (${lv.name}): NOT COMPLETABLE by the bot (expanded ${res.expanded} nodes, ${secs}s)`);
      return;
    }
    const rp = replay(TP, li, res.path);
    const route = rp.steps.map((s) => s.to).join(' > ');
    console.log(`Level ${li + 1}: completable in ${res.path.length} jumps (${secs}s). Route: ${rp.steps[0].from} > ${route}`);
    if (!rp.complete) { allOk = false; console.log('  !! replay did not complete'); }
    if (wantF) {
      const f = rp.steps.map((s) => timingWindow(TP, s));
      const fmt = f.map((v, i) => `${rp.steps[i].from}>${rp.steps[i].to}:${v}`).join('  ');
      console.log(`  jump timing window (frames @60fps): min ${Math.min(...f)}  avg ${(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1)}`);
      console.log('  ' + fmt);
    }
    solutions[li] = res.path;
  });
  if (save) {
    fs.writeFileSync(path.join(__dirname, 'solutions.json'), JSON.stringify(solutions));
    console.log('Saved tools/solutions.json');
  }
  if (!allOk) process.exit(1);
}

if (require.main === module) main();
module.exports = { loadTP, run, actionInputs, solve, replay };
