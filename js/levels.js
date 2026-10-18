/* ==========================================================
   levels.js — five hand-designed levels.
   Toilet: seat at (x, y) with width w. f: 'R' = tank on the left,
   'L' = tank on the right. The tank lid is a small extra platform.
   All levels are verified completable by tools/verify-levels.js.
   ========================================================== */
(function (TP) {
  'use strict';

  function T(x, y, w, f, extra) {
    const t = { x: x, y: y, w: w, f: f || 'R' };
    if (extra) for (const k in extra) t[k] = extra[k];
    return t;
  }
  const I = (x, y, k) => ({ x: x, y: y, k: k || 'sheet' });

  TP.LEVELS = [
    // -------------------------------------------------------
    // LEVEL 1 — The First Step: big toilets, small gaps.
    // -------------------------------------------------------
    {
      name: 'הצעד הראשון',
      tip: 'קפצו מאסלה לאסלה עד אסלת הזהב!',
      width: 800,
      start: 0,
      toilets: [
        T(30, 122, 44, 'R'),
        T(96, 122, 40, 'R', { c: 'blue' }),
        T(162, 116, 40, 'L'),
        T(236, 116, 40, 'R'),
        T(304, 126, 40, 'R', { c: 'blue' }),
        T(372, 120, 36, 'L'),
        T(440, 112, 36, 'R'),
        T(504, 118, 36, 'R', { c: 'blue' }),
        T(572, 124, 36, 'L'),
        T(640, 116, 36, 'R'),
        T(708, 114, 44, 'R', { type: 'golden' })
      ],
      items: [
        I(85, 100), I(116, 112), I(149, 96), I(219, 88), I(287, 98),
        I(390, 110), I(488, 90), I(556, 96), I(624, 94), I(690, 90)
      ],
      hazards: [],
      hints: [
        { x: 92, y: 30, text: '← → / A D - הליכה', touch: 'כפתורי החצים - הליכה' },
        { x: 92, y: 42, text: 'רווח / W / ↑ - קפיצה', touch: 'כפתור "קפיצה" - קפיצה' },
        { x: 92, y: 54, text: 'החזיקו לקפיצה גבוהה יותר', touch: 'החזיקו לקפיצה גבוהה יותר' },
        { x: 730, y: 50, text: 'אסלת הזהב = סוף השלב!', touch: 'אסלת הזהב = סוף השלב!' }
      ]
    },

    // -------------------------------------------------------
    // LEVEL 2 — Between the Toilets: wider gaps, real height changes.
    // -------------------------------------------------------
    {
      name: 'בין האסלות',
      tip: 'קפיצות ארוכות וגבוהות. החזיקו את הקפיצה!',
      width: 1110,
      start: 0,
      toilets: [
        T(30, 130, 36, 'R'),
        T(100, 118, 32, 'R', { c: 'blue' }),
        T(170, 104, 30, 'L'),
        T(246, 92, 30, 'R'),
        T(316, 112, 30, 'R', { c: 'blue' }),
        T(388, 132, 32, 'L'),
        T(464, 116, 28, 'R'),
        T(530, 98, 28, 'R', { c: 'blue' }),
        T(596, 82, 28, 'L'),
        T(676, 104, 30, 'R'),
        T(748, 128, 30, 'R', { c: 'blue' }),
        T(816, 110, 26, 'L'),
        T(890, 92, 28, 'R'),
        T(960, 108, 30, 'R', { c: 'blue' }),
        T(1030, 100, 40, 'R', { type: 'golden' })
      ],
      items: [
        I(84, 104), I(152, 90), I(226, 74, 'star'), I(296, 80), I(368, 102),
        I(444, 104), I(512, 84), I(578, 52, 'star'), I(652, 76), I(728, 100),
        I(800, 98), I(870, 78), I(938, 84), I(996, 70, 'star'), I(1010, 92)
      ],
      hazards: []
    },

    // -------------------------------------------------------
    // LEVEL 3 — Caution, Wet!: water splashes, soap, slippery seats.
    // -------------------------------------------------------
    {
      name: 'זהירות, רטוב!',
      tip: 'חכו שהמים יירגעו... ואז קפצו!',
      width: 1200,
      start: 0,
      toilets: [
        T(30, 124, 34, 'R'),
        T(96, 120, 28, 'R', { c: 'blue' }),
        T(160, 120, 28, 'L', { geyser: { period: 3.0, offset: 0 } }),
        T(232, 110, 26, 'R'),
        T(298, 116, 26, 'R', { geyser: { period: 2.6, offset: 1.3 } }),
        T(362, 112, 26, 'L', { geyser: { period: 2.6, offset: 0 } }),
        T(436, 104, 40, 'R', { c: 'blue' }),
        T(506, 118, 26, 'R'),
        T(578, 104, 24, 'L', { geyser: { period: 2.4, offset: 0.6 } }),
        T(646, 94, 24, 'R', { c: 'blue' }),
        T(712, 110, 44, 'R'),
        T(792, 120, 26, 'R', { geyser: { period: 2.6, offset: 0.3 } }),
        T(846, 114, 40, 'R', { type: 'slippery' }),
        T(918, 108, 40, 'R', { type: 'slippery' }),
        T(990, 112, 26, 'R', { c: 'blue' }),
        T(1050, 104, 26, 'L', { geyser: { period: 2.6, offset: 1.0 } }),
        T(1124, 100, 40, 'R', { type: 'golden' })
      ],
      items: [
        I(80, 100), I(142, 98), I(174, 112, 'bubble'), I(214, 92), I(280, 94),
        I(344, 92, 'bubble'), I(420, 84), I(456, 96), I(488, 92), I(556, 90),
        I(628, 74, 'star'), I(694, 86), I(734, 102, 'bubble'), I(771, 94), I(830, 98),
        I(866, 104, 'bubble'), I(898, 92), I(970, 92), I(1033, 90), I(1103, 70, 'star')
      ],
      hazards: [
        { k: 'soap', toilet: 6, speed: 26, phase: 0.5 },
        { k: 'soap', toilet: 10, speed: 32, phase: 0 }
      ]
    },

    // -------------------------------------------------------
    // LEVEL 4 — Toilets in Motion: moving and crumbling toilets.
    // -------------------------------------------------------
    {
      name: 'אסלות בתנועה',
      tip: 'אסלות זזות ואסלות סדוקות. התזמון הוא הכול!',
      width: 1300,
      start: 0,
      toilets: [
        T(30, 120, 34, 'R'),
        T(100, 114, 28, 'R', { c: 'blue' }),
        T(178, 114, 28, 'R', { type: 'moving', move: { ax: 22, period: 3.4 } }),
        T(250, 110, 26, 'L'),
        T(318, 118, 26, 'R', { type: 'unstable' }),
        T(386, 110, 26, 'R', { c: 'blue' }),
        T(466, 104, 26, 'L', { type: 'moving', move: { ax: 28, period: 3.0 } }),
        T(556, 112, 26, 'R', { type: 'moving', move: { ax: 26, period: 3.0, phase: Math.PI } }),
        T(638, 100, 28, 'R'),
        T(702, 108, 26, 'L', { type: 'unstable' }),
        T(770, 100, 26, 'R', { type: 'unstable' }),
        T(836, 110, 28, 'R', { c: 'blue' }),
        T(918, 100, 26, 'R', { type: 'moving', move: { ax: 30, period: 3.0 } }),
        T(1004, 96, 26, 'L'),
        T(1082, 108, 26, 'R', { type: 'moving', move: { ax: 24, period: 2.8, phase: 1.2 } }),
        T(1160, 100, 26, 'R', { c: 'blue' }),
        T(1224, 96, 40, 'R', { type: 'golden' })
      ],
      items: [
        I(82, 98), I(140, 94), I(192, 96, 'bubble'), I(232, 90), I(300, 94),
        I(366, 92), I(426, 86), I(512, 84, 'star'), I(600, 88), I(684, 44, 'star'),
        I(715, 96), I(783, 88), I(815, 90), I(890, 86), I(974, 84, 'bubble'),
        I(1048, 84), I(1140, 86), I(1202, 84)
      ],
      hazards: [
        { k: 'plunger', x: 684, y: 72, ay: 20, period: 2.6 },
        { k: 'plunger', x: 1044, y: 62, ax: 26, period: 3.2 }
      ]
    },

    // -------------------------------------------------------
    // LEVEL 5 — The Porcelain Throne: everything, fair but demanding.
    // -------------------------------------------------------
    {
      name: 'כס החרסינה',
      tip: 'המסע האחרון אל כס החרסינה. בהצלחה!',
      width: 1630,
      start: 0,
      toilets: [
        T(30, 124, 32, 'R'),
        T(94, 112, 26, 'R', { geyser: { period: 2.8, offset: 0.4 } }),
        T(172, 104, 24, 'R', { type: 'moving', move: { ax: 26, period: 2.8 } }),
        T(254, 96, 24, 'L', { type: 'unstable' }),
        T(318, 112, 26, 'R', { c: 'blue' }),
        T(388, 100, 40, 'R', { c: 'blue' }),
        T(466, 90, 24, 'L', { geyser: { period: 3.2, offset: 1.2 } }),
        T(536, 104, 24, 'R', { type: 'moving', move: { ax: 26, period: 2.6 } }),
        T(628, 118, 28, 'R', { type: 'slippery' }),
        T(694, 104, 24, 'L', { type: 'unstable' }),
        T(756, 92, 24, 'R', { type: 'unstable' }),
        T(820, 84, 26, 'R', { c: 'blue' }),
        T(902, 98, 24, 'L', { type: 'moving', move: { ax: 28, period: 2.4 } }),
        T(986, 110, 26, 'R', { geyser: { period: 2.4, offset: 0.2 } }),
        T(1052, 100, 40, 'R'),
        T(1128, 92, 24, 'R', { type: 'moving', move: { ax: 26, period: 3.0, phase: 2 } }),
        T(1210, 104, 24, 'L', { type: 'unstable' }),
        T(1284, 96, 28, 'R', { type: 'slippery' }),
        T(1362, 88, 24, 'R', { type: 'moving', move: { ax: 26, period: 2.4 } }),
        T(1442, 104, 26, 'L', { c: 'blue' }),
        T(1514, 98, 56, 'R', { type: 'golden', throne: true })
      ],
      items: [
        I(78, 100), I(150, 88), I(214, 80, 'bubble'), I(290, 78), I(354, 96),
        I(426, 60, 'star'), I(450, 80), I(508, 76), I(588, 90, 'bubble'), I(664, 98),
        I(728, 82), I(792, 72), I(864, 70), I(946, 82), I(1022, 92),
        I(1092, 70, 'star'), I(1180, 78), I(1254, 86), I(1324, 76), I(1404, 74),
        I(1482, 84)
      ],
      hazards: [
        { k: 'plunger', x: 352, y: 76, ay: 20, period: 2.2 },
        { k: 'soap', toilet: 5, speed: 34, phase: 0.2 },
        { k: 'plunger', x: 862, y: 56, ax: 28, period: 2.8 },
        { k: 'soap', toilet: 14, speed: 34, phase: 0.7 },
        { k: 'plunger', x: 1491, y: 72, ay: 20, period: 2.4, phase: 1 }
      ]
    }
  ];
})(window.TP = window.TP || {});
