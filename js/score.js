/* ==========================================================
   score.js — score, lives, high score (localStorage) and the
   furthest level reached (for level select).
   ========================================================== */
(function (TP) {
  'use strict';

  function readInt(key) {
    try {
      const v = parseInt(localStorage.getItem(key), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }
  function writeInt(key, v) {
    try { localStorage.setItem(key, String(v)); } catch (e) { /* storage unavailable */ }
  }

  const S = {
    score: 0,
    lives: TP.START_LIVES,
    high: readInt(TP.STORAGE.high),
    reached: Math.min(readInt(TP.STORAGE.reached), 4),
    newHigh: false,
    extraGiven: false,

    reset() {
      this.score = 0;
      this.lives = TP.START_LIVES;
      this.newHigh = false;
      this.extraGiven = false;
    },

    /** Adds points. Returns true if this crossed the extra-life threshold. */
    add(n) {
      this.score += n;
      if (this.score > this.high) {
        this.high = this.score;
        this.newHigh = true;
        writeInt(TP.STORAGE.high, this.high);
      }
      if (!this.extraGiven && this.score >= TP.SCORE.extraLifeAt) {
        this.extraGiven = true;
        this.lives = Math.min(TP.MAX_LIVES, this.lives + 1);
        return true;
      }
      return false;
    },

    /** Used when restarting a level: take back the points from this attempt. */
    setScore(n) {
      this.score = n;
    },

    loseLife() {
      this.lives = Math.max(0, this.lives - 1);
      return this.lives;
    },

    markReached(levelIndex) {
      if (levelIndex > this.reached) {
        this.reached = levelIndex;
        writeInt(TP.STORAGE.reached, levelIndex);
      }
    },

    reloadHigh() {
      this.high = Math.max(this.high, readInt(TP.STORAGE.high));
    }
  };

  TP.Score = S;
})(window.TP = window.TP || {});
