/* ==========================================================
   audio.js — Atari-style synthesized sound (Web Audio API).
   No sound files: square/triangle waves + crunchy noise.
   The AudioContext is only created after a user gesture.
   ========================================================== */
(function (TP) {
  'use strict';

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let whiteBuf = null;
  let crunchBuf = null;

  const store = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    }
  };

  let soundOn = store.get(TP.STORAGE.sound, true);
  let musicOn = store.get(TP.STORAGE.music, true);

  function makeNoise(hold) {
    const len = ctx.sampleRate;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      if (i % hold === 0) v = Math.random() * 2 - 1;
      d[i] = v;
    }
    return b;
  }

  /** Create / resume the context. Call from a user-gesture handler. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = soundOn ? 0.8 : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.6;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.32;
    musicBus.connect(master);
    whiteBuf = makeNoise(1);
    crunchBuf = makeNoise(6);   // sample-and-hold = gritty TIA-like noise
    if (music.want != null) startMusic(music.want);
  }

  const ready = () => !!ctx && ctx.state !== 'closed';

  // ---------------- primitives ----------------
  function tone(t0, freq, dur, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.slide || dur));
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.004);
    g.gain.setValueAtTime(v, t0 + dur * (o.sustain == null ? 0.6 : o.sustain));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.bus || sfxBus);
    if (o.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vib;
      lg.gain.value = o.vibDepth || 25;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, o) {
    o = o || {};
    const src = ctx.createBufferSource();
    src.buffer = o.crunchy ? crunchBuf : whiteBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function hz(n) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(n);
    if (!m) return 0;
    const s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) - 4) * 12;
    return 440 * Math.pow(2, s / 12);
  }

  /** Play "C5:2 E5:1 -:1 ..." where the number is a length in units. */
  function seq(t0, str, unit, o) {
    let t = t0;
    for (const tok of str.trim().split(/\s+/)) {
      const [n, l] = tok.split(':');
      const d = (parseFloat(l) || 1) * unit;
      if (n !== '-') tone(t, hz(n), d * 0.92, o);
      t += d;
    }
    return t;
  }

  // ---------------- sound effects ----------------
  const SFX = {
    jump(t) { tone(t, 250, 0.15, { to: 760, vol: 0.13 }); },
    land(t) {
      tone(t, 150, 0.08, { to: 55, type: 'triangle', vol: 0.4 });
      noise(t, 0.05, { freq: 800, vol: 0.12 });
    },
    collect(t) { tone(t, 988, 0.06, { vol: 0.12 }); tone(t + 0.06, 1319, 0.12, { vol: 0.12 }); },
    bubble(t) {
      tone(t, 420, 0.1, { to: 1600, type: 'sine', vol: 0.3 });
      noise(t + 0.08, 0.04, { filter: 'highpass', freq: 3000, vol: 0.1 });
    },
    star(t) { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(t + i * 0.05, f, 0.08, { vol: 0.11 })); },
    perfect(t) { [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + i * 0.045, f, 0.09, { vol: 0.1 })); },
    talk(t) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) tone(t + i * 0.075, 480 + Math.random() * 420, 0.05, { vol: 0.06 });
    },
    hurt(t) {
      tone(t, 620, 0.6, { to: 70, vol: 0.16, vib: 16, vibDepth: 45 });
      noise(t, 0.25, { freq: 1500, to: 200, vol: 0.14, crunchy: true });
    },
    fall(t) { tone(t, 1050, 0.9, { to: 80, type: 'triangle', vol: 0.3, sustain: 0.9 }); },
    splash(t) { noise(t, 0.5, { filter: 'bandpass', freq: 2600, to: 500, q: 0.7, vol: 0.28 }); },
    gurgle(t) {
      for (let i = 0; i < 6; i++) tone(t + i * 0.1, 90 + Math.random() * 90, 0.07, { type: 'sine', to: 260, vol: 0.16 });
    },
    crack(t) {
      noise(t, 0.07, { filter: 'highpass', freq: 1400, vol: 0.3, crunchy: true });
      tone(t, 92, 0.14, { vol: 0.12 });
    },
    crumble(t) { noise(t, 0.55, { freq: 1000, to: 100, vol: 0.32, crunchy: true }); },
    rebuild(t) { [392, 523, 659].forEach((f, i) => tone(t + i * 0.05, f, 0.06, { vol: 0.05 })); },
    menuMove(t) { tone(t, 440, 0.04, { vol: 0.09 }); },
    menuSelect(t) { tone(t, 660, 0.05, { vol: 0.11 }); tone(t + 0.05, 990, 0.09, { vol: 0.11 }); },
    pause(t) { tone(t, 880, 0.05, { vol: 0.09 }); tone(t + 0.07, 440, 0.08, { vol: 0.09 }); },
    tick(t) { tone(t, 1250, 0.025, { vol: 0.05 }); },
    extraLife(t) { seq(t, 'C5:1 E5:1 G5:1 C6:1 G5:1 C6:1 E6:1 G6:2', 0.06, { vol: 0.1 }); },
    levelDone(t) {
      seq(t, 'C5:1 E5:1 G5:1 C6:2 G5:1 C6:4', 0.09, { vol: 0.12 });
      seq(t, 'C3:3 G2:3 C3:4', 0.09, { type: 'triangle', vol: 0.3 });
    },
    gameOver(t) {
      seq(t, 'G4:2 F#4:2 F4:2 E4:2 Eb4:2 D4:6', 0.13, { vol: 0.12 });
      seq(t, 'C3:4 B2:4 Bb2:2 A2:6', 0.13, { type: 'triangle', vol: 0.3 });
    },
    victory(t) {
      const u = 0.1;
      seq(t, 'G4:1 C5:1 E5:1 G5:2 E5:1 G5:3 A5:1 G5:1 F5:1 E5:1 D5:1 E5:1 C5:3 G5:1 A5:1 B5:1 C6:6', u, { vol: 0.12 });
      seq(t, 'C3:4 C3:4 F3:4 G3:4 C3:2 G2:2 C3:6', u, { type: 'triangle', vol: 0.32 });
    },
    start(t) { seq(t, 'C5:1 G5:1 C6:2', 0.07, { vol: 0.11 }); }
  };

  function play(name) {
    if (!ready() || !soundOn) return;
    const f = SFX[name];
    if (f) { try { f(ctx.currentTime + 0.005); } catch (e) { /* ignore */ } }
  }

  // ---------------- background music (two-channel, TIA style) ----------------
  // Original tunes. Each step is an eighth note; "." = rest.
  const TRACKS = [
    { // 0: title — gentle and polite
      bpm: 112,
      lead: 'E5 . . D5 C5 . D5 . E5 . G5 . E5 . . . D5 . . C5 B4 . C5 . D5 . . . G4 . . . ' +
            'E5 . . D5 C5 . D5 . E5 . G5 . C6 . . . B5 . A5 . G5 . F5 . E5 . D5 . C5 . . .',
      bass: 'C3 . . . G2 . . . A2 . . . E2 . . . F2 . . . C3 . . . G2 . . . G2 . . . ' +
            'C3 . . . G2 . . . A2 . . . E2 . . . F2 . . . G2 . . . C3 . . . C3 . . .'
    },
    { // 1: levels — bouncy
      bpm: 150,
      lead: 'C5 . E5 G5 . E5 C5 . D5 . F5 A5 . F5 D5 . E5 G5 C6 G5 E5 G5 C6 . B4 D5 G5 D5 B4 . G4 . ' +
            'A4 . C5 E5 . C5 A4 . F4 . A4 C5 F5 . C5 . G4 B4 D5 G5 F5 D5 B4 G4 C5 . G4 . C5 . . .',
      bass: 'C3 . G3 . C3 . G3 . D3 . A3 . D3 . A3 . C3 . G3 . E3 . G3 . G2 . D3 . G2 . B2 . ' +
            'A2 . E3 . A2 . E3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 . C3 . G2 . C3 . . .'
    },
    { // 2: final level — urgent
      bpm: 164,
      lead: 'A4 . C5 E5 A5 . E5 C5 G4 . B4 D5 G5 . D5 B4 F4 . A4 C5 F5 . C5 A4 E4 G#4 B4 E5 G#5 . E5 . ' +
            'A4 C5 E5 A5 G5 E5 C5 E5 F5 D5 B4 D5 E5 C5 A4 C5 D5 B4 G4 B4 C5 A4 F4 A4 B4 G#4 E4 G#4 A4 . . .',
      bass: 'A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 . F2 . C3 . F2 . C3 . E2 . B2 . E2 . G#2 . ' +
            'A2 . E3 . A2 . E3 . D3 . A3 . D3 . A3 . G2 . D3 . G2 . D3 . E2 . B2 . E2 . E2 . '
    }
  ];

  const music = { track: null, want: null, step: 0, next: 0, timer: null, lead: null, bass: null };

  function scheduleMusic() {
    if (!ready() || music.track == null) return;
    const tr = TRACKS[music.track];
    const stepDur = 60 / tr.bpm / 2;
    while (music.next < ctx.currentTime + 0.3) {
      const i = music.step % music.lead.length;
      const ln = music.lead[i];
      const bn = music.bass[i % music.bass.length];
      if (ln !== '.') tone(music.next, hz(ln), stepDur * 0.85, { vol: 0.07, bus: musicBus, sustain: 0.3 });
      if (bn !== '.') tone(music.next, hz(bn), stepDur * 1.6, { type: 'triangle', vol: 0.2, bus: musicBus, sustain: 0.5 });
      music.next += stepDur;
      music.step++;
    }
    music.timer = setTimeout(scheduleMusic, 80);
  }

  function startMusic(index) {
    music.want = index;
    if (!ready() || !musicOn) return;
    if (music.track === index && music.timer) return;
    stopTimer();
    music.track = index;
    music.lead = TRACKS[index].lead.trim().split(/\s+/);
    music.bass = TRACKS[index].bass.trim().split(/\s+/);
    music.step = 0;
    music.next = ctx.currentTime + 0.12;
    scheduleMusic();
  }

  function stopTimer() {
    if (music.timer) clearTimeout(music.timer);
    music.timer = null;
  }

  function stopMusic() {
    stopTimer();
    music.track = null;
    music.want = null;
  }

  /** Temporarily silence the music (pause screen) without forgetting it. */
  function holdMusic(on) {
    if (on) { stopTimer(); return; }
    if (music.track != null && musicOn && ready() && !music.timer) {
      music.next = ctx.currentTime + 0.08;
      scheduleMusic();
    }
  }

  function setSound(on) {
    soundOn = !!on;
    store.set(TP.STORAGE.sound, soundOn);
    if (master) master.gain.setTargetAtTime(soundOn ? 0.8 : 0, ctx.currentTime, 0.02);
  }

  function setMusic(on) {
    musicOn = !!on;
    store.set(TP.STORAGE.music, musicOn);
    if (!musicOn) {
      const want = music.want;
      stopTimer();
      music.track = null;
      music.want = want;
    } else if (music.want != null) {
      startMusic(music.want);
    }
  }

  TP.Audio = {
    unlock, play, startMusic, stopMusic, holdMusic,
    setSound, setMusic,
    toggleSound() { setSound(!soundOn); return soundOn; },
    get soundOn() { return soundOn; },
    get musicOn() { return musicOn; },
    get ready() { return ready(); },
    get state() { return ctx ? ctx.state : 'none'; }
  };
})(window.TP = window.TP || {});
