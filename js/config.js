/* ==========================================================
   גליל נייר התואלט המנומס — config.js
   Global constants: resolution, palette, physics, scoring.
   Pure data — safe to load in Node (used by tools/verify-levels.js).
   ========================================================== */
(function (TP) {
  'use strict';

  TP.VERSION = '1.0.0';

  // Internal (virtual) resolution — everything is drawn at this size
  // and scaled up with nearest-neighbour filtering.
  TP.W = 320;
  TP.H = 180;

  // Fixed simulation step (seconds).
  TP.STEP = 1 / 60;

  // Atari-2600-inspired limited palette.
  TP.PAL = {
    black:   '#000000',
    night:   '#0c0c24',   // very dark blue, panels
    dim:     '#2c3c8c',   // distant stars
    dimGrey: '#404040',
    grey:    '#909090',
    light:   '#c8c8c8',
    white:   '#ececec',
    cream:   '#e8dcb8',
    water:   '#6ca8fc',   // toilet water / light blue
    cyan:    '#84e0fc',   // highlights
    blue:    '#4878d8',
    green:   '#5cbc5c',
    dkGreen: '#2c7c2c',
    yellow:  '#fcfc68',
    gold:    '#e8b030',
    orange:  '#f08c3c',
    red:     '#d82828',
    dkRed:   '#8c1818',
    pink:    '#f0a0a0',
    tan:     '#b07040',
    brown:   '#5c3018'
  };

  // Player physics (pixels, seconds). Tuned for arcade feel, not realism.
  TP.PHYS = {
    runSpeed: 86,        // max horizontal speed
    groundAccel: 1100,
    groundDecel: 1500,
    airAccel: 700,
    airDecel: 260,
    slipAccel: 240,      // slippery toilets: low traction
    slipDecel: 70,
    jumpSpeed: 262,      // initial upward velocity
    gravityUp: 820,      // while rising with jump held
    gravityCut: 2100,    // while rising after jump released (variable height)
    gravityDown: 1150,   // while falling
    maxFall: 330,
    coyote: 0.09,        // grace period after walking off a ledge
    buffer: 0.13,        // jump pressed slightly before landing still counts
    footHalf: 4,         // half-width of the feet (landing) box
    bodyHalf: 4,         // half-width of the hurt box
    bodyHeight: 13,      // height of the hurt box
    perfectDist: 3       // |player - seat centre| for a "polite landing"
  };

  // Toilet geometry (side view).
  TP.TOILET = {
    tankW: 7,            // tank width (behind the seat)
    lidRise: 10          // tank lid is this many px above the seat
  };

  TP.SCORE = {
    item: 50,            // golden sheet / soap bubble
    star: 100,           // golden star (risky placement)
    land: 25,            // first landing on each toilet
    perfect: 100,        // polite (centred) landing
    level: 500,          // level completion
    noDeath: 1000,       // level completed without losing a life
    allItems: 300,       // every collectible in the level
    extraLifeAt: 10000   // one extra life at this score
  };

  TP.START_LIVES = 3;
  TP.MAX_LIVES = 5;

  TP.STORAGE = {
    high: 'politeRoll.highScore',
    sound: 'politeRoll.sound',
    music: 'politeRoll.music',
    reached: 'politeRoll.reached'
  };
})(window.TP = window.TP || {});
