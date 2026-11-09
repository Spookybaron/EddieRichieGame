/* Background music: plays ER.MUSIC_DATA (made from a MIDI file by
   tools/midi_to_js.py) through a tiny Web Audio synth, quietly, on a loop.
   M mutes everything; N turns just the music on or off. */
window.ER = window.ER || {};

ER.Music = {
  enabled: true,
  playing: false,
  volume: 0.32,
  events: null,
  length: 0,
  idx: 0,
  songStart: 0,
  timer: null,
  out: null,
  noise: null,

  VOICE_GAIN: { organ: 0.05, guitar: 0.03, brass: 0.045, bass: 0.1 },

  load: function () {
    try { this.enabled = localStorage.getItem("er-music") !== "0"; } catch (e) {}
    var d = ER.MUSIC_DATA;
    if (!d) return;
    var ev = [];
    Object.keys(d.voices).forEach(function (v) {
      var a = d.voices[v];
      for (var i = 0; i < a.length; i += 4) {
        ev.push({ t: a[i] / 100, d: a[i + 1] / 100, n: a[i + 2], v: a[i + 3] / 127, voice: v });
      }
    });
    ev.sort(function (x, y) { return x.t - y.t; });
    this.events = ev;
    this.length = d.length;
  },

  setEnabled: function (on) {
    this.enabled = !!on;
    try { localStorage.setItem("er-music", this.enabled ? "1" : "0"); } catch (e) {}
    if (this.enabled) this.start();
    else this.stop();
  },

  /* Called after the first click or key press (browsers block sound before that). */
  start: function () {
    if (!this.enabled || this.playing || !this.events) return;
    var ctx = ER.Audio._ensure();
    if (!ctx) return;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.connect(ctx.destination);
      this.noise = this._makeNoise(ctx);
    }
    this.syncVolume();
    this.playing = true;
    this.idx = 0;
    this.songStart = ctx.currentTime + 0.15;
    var self = this;
    this.timer = setInterval(function () { self._schedule(); }, 90);
    this._schedule();
  },

  stop: function () {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.out) {
      var ctx = ER.Audio.ctx;
      /* Fade out, then swap in a fresh output so already-queued notes go silent. */
      this.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      var old = this.out;
      setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 400);
      this.out = null;
    }
  },

  syncVolume: function () {
    if (!this.out) return;
    var ctx = ER.Audio.ctx;
    var v = ER.Audio.muted ? 0 : this.volume;
    this.out.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
  },

  _schedule: function () {
    var ctx = ER.Audio.ctx;
    if (!ctx || !this.playing) return;
    var ahead = ctx.currentTime + 0.35;
    var guard = 0;
    while (guard++ < 400) {
      if (this.idx >= this.events.length) {
        /* Loop round to the start. */
        this.songStart += this.length;
        this.idx = 0;
      }
      var e = this.events[this.idx];
      var when = this.songStart + e.t;
      if (when > ahead) break;
      if (when >= ctx.currentTime - 0.05) this._play(ctx, e, Math.max(when, ctx.currentTime));
      this.idx += 1;
    }
  },

  _makeNoise: function (ctx) {
    var buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  },

  _freq: function (n) { return 440 * Math.pow(2, (n - 69) / 12); },

  _env: function (ctx, t, dur, peak, attack, release) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    g.connect(this.out);
    return g;
  },

  _osc: function (ctx, type, f, t, end, dest) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  },

  _play: function (ctx, e, t) {
    if (!this.out) return;
    if (e.voice === "drums") { this._drum(ctx, e.n, e.v, t); return; }
    var f = this._freq(e.n);
    var dur = Math.min(e.d, 2.5);
    var peak = Math.max(0.0002, this.VOICE_GAIN[e.voice] * (0.5 + e.v * 0.5));
    var end = t + dur + 0.25;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";

    if (e.voice === "organ") {
      var g = this._env(ctx, t, dur, peak, 0.01, 0.06);
      lp.frequency.value = 2200;
      lp.connect(g);
      this._osc(ctx, "square", f, t, end, lp);
      var g2 = ctx.createGain();
      g2.gain.value = 0.6;
      g2.connect(lp);
      this._osc(ctx, "sine", f * 2, t, end, g2);
    } else if (e.voice === "guitar") {
      var gg = this._env(ctx, t, Math.min(dur, 0.6), peak, 0.005, 0.12);
      lp.frequency.setValueAtTime(3000, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
      lp.connect(gg);
      this._osc(ctx, "sawtooth", f, t, end, lp);
    } else if (e.voice === "brass") {
      var gb = this._env(ctx, t, dur, peak, 0.03, 0.08);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
      lp.connect(gb);
      this._osc(ctx, "sawtooth", f, t, end, lp);
      this._osc(ctx, "sawtooth", f * 1.004, t, end, lp);
    } else {
      var gl = this._env(ctx, t, dur, peak, 0.008, 0.06);
      lp.frequency.value = 900;
      lp.connect(gl);
      this._osc(ctx, "triangle", f, t, end, lp);
      this._osc(ctx, "sine", f / 2, t, end, lp);
    }
  },

  _drum: function (ctx, kind, vel, t) {
    var v = 0.4 + vel * 0.6;
    if (kind === 0) {
      /* Kick: a falling sine thump. */
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.28 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      g.connect(this.out);
      var o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    var flt = ctx.createBiquadFilter();
    var gn = ctx.createGain();
    var len, amp;
    if (kind === 1) { flt.type = "bandpass"; flt.frequency.value = 1800; len = 0.14; amp = 0.16; }
    else if (kind === 2) { flt.type = "highpass"; flt.frequency.value = 7000; len = 0.045; amp = 0.05; }
    else { flt.type = "highpass"; flt.frequency.value = 5000; len = 0.6; amp = 0.05; }
    gn.gain.setValueAtTime(amp * v, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(flt);
    flt.connect(gn);
    gn.connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
    if (kind === 1) {
      /* A bit of body under the snare. */
      var gt = ctx.createGain();
      gt.gain.setValueAtTime(0.06 * v, t);
      gt.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      gt.connect(this.out);
      this._osc(ctx, "triangle", 190, t, t + 0.1, gt);
    }
  }
};
