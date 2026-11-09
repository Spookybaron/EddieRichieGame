/* Tiny generated beeps. No recorded or copyrighted audio. */
window.ER = window.ER || {};

ER.Audio = {
  ctx: null,
  muted: false,
  quiet: false, /* true while the demo fight plays behind the title screen */
  unlocked: false,

  _ensure: function () {
    if (this.ctx) return this.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    return this.ctx;
  },

  unlock: function () {
    var ctx = this._ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    this.unlocked = true;
  },

  setMuted: function (m) {
    this.muted = !!m;
    try { localStorage.setItem("er-mute", this.muted ? "1" : "0"); } catch (e) {}
  },

  loadMute: function () {
    try { this.muted = localStorage.getItem("er-mute") === "1"; } catch (e) {}
    return this.muted;
  },

  beep: function (freq, dur, type, vol, slide) {
    if (this.muted || this.quiet) return;
    var ctx = this._ensure();
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  swing: function () { this.beep(180, 0.12, "sawtooth", 0.06, 90); },
  hit: function () { this.beep(140, 0.16, "square", 0.09, 60); },
  pickup: function () { this.beep(520, 0.08, "triangle", 0.06, 740); },
  throw: function () { this.beep(320, 0.1, "square", 0.07, 180); },
  drop: function () { this.beep(200, 0.07, "triangle", 0.04, 140); },
  win: function () {
    var self = this;
    this.beep(440, 0.12, "square", 0.07);
    setTimeout(function () { self.beep(554, 0.12, "square", 0.07); }, 110);
    setTimeout(function () { self.beep(659, 0.22, "square", 0.08); }, 220);
  },
  bell: function () {
    var self = this;
    this.beep(988, 0.25, "triangle", 0.07);
    setTimeout(function () { self.beep(988, 0.35, "triangle", 0.06); }, 160);
  },
  fight: function () {
    var self = this;
    this.beep(392, 0.08, "square", 0.07);
    setTimeout(function () { self.beep(784, 0.18, "square", 0.08, 880); }, 70);
  },
  ko: function () {
    var self = this;
    this.beep(220, 0.3, "sawtooth", 0.09, 55);
    setTimeout(function () { self.beep(110, 0.45, "square", 0.07, 40); }, 120);
  },
  ui: function () { this.beep(660, 0.05, "square", 0.04); }
};
