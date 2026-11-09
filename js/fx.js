/* Particles, comic hit words and other little flourishes drawn in the world. */
window.ER = window.ER || {};

ER.FX = {
  parts: [],
  pops: [],

  clear: function () {
    this.parts = [];
    this.pops = [];
  },

  _add: function (p) {
    if (this.parts.length > 260) this.parts.shift();
    this.parts.push(p);
  },

  /* Little puffs of floor dust (footsteps, turns, landings, knockbacks). */
  dust: function (x, y, n, dir) {
    for (var i = 0; i < (n || 3); i++) {
      this._add({
        kind: "dust", x: x + (Math.random() * 8 - 4), y: y - 1,
        vx: (dir || 0) * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.5,
        vy: -0.15 - Math.random() * 0.35,
        r: 1.5 + Math.random() * 2, life: 0, max: 18 + Math.random() * 12,
        color: "rgba(235,222,196,"
      });
    }
  },

  /* A burst of stars and sparks where a hit lands. */
  stars: function (x, y, color, n) {
    n = n || 10;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 1.2 + Math.random() * 2.4;
      this._add({
        kind: i % 3 === 0 ? "star" : "spark", x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
        r: i % 3 === 0 ? 2.5 : 1.2, life: 0, max: 16 + Math.random() * 12,
        color: i % 2 ? color : "#fff6c8", grav: 0.12
      });
    }
  },

  /* Pillows lose feathers. */
  feathers: function (x, y) {
    for (var i = 0; i < 9; i++) {
      this._add({
        kind: "feather", x: x + (Math.random() * 10 - 5), y: y + (Math.random() * 6 - 3),
        vx: (Math.random() - 0.5) * 1.6, vy: -0.6 - Math.random() * 1.2,
        r: 2, life: 0, max: 50 + Math.random() * 30, color: "#fbf6ea",
        grav: 0.02, sway: Math.random() * 6
      });
    }
  },

  /* Cartoon word that pops up at an impact. */
  pop: function (x, y, text, color) {
    if (this.pops.length > 6) this.pops.shift();
    this.pops.push({ x: x, y: y, text: text, color: color || "#ffe08a", t: 0, rot: (Math.random() - 0.5) * 0.3 });
  },

  update: function () {
    var keep = [];
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      p.life += 1;
      p.x += p.vx;
      p.y += p.vy;
      if (p.grav) p.vy += p.grav;
      if (p.kind === "dust") { p.vx *= 0.92; p.vy *= 0.94; p.r += 0.12; }
      if (p.kind === "feather") { p.vx = Math.sin((p.life + p.sway * 10) / 9) * 0.6; p.vy = Math.min(p.vy, 0.5); }
      if (p.life < p.max) keep.push(p);
    }
    this.parts = keep;
    var pk = [];
    for (var j = 0; j < this.pops.length; j++) {
      this.pops[j].t += 1;
      if (this.pops[j].t < 42) pk.push(this.pops[j]);
    }
    this.pops = pk;
  },

  draw: function (ctx) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      var k = p.life / p.max;
      if (p.kind === "dust") {
        ctx.fillStyle = p.color + (0.55 * (1 - k)).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "star") {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        var s = Math.round(p.r);
        ctx.fillRect(Math.round(p.x) - s, Math.round(p.y), s * 2 + 1, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - s, 1, s * 2 + 1);
        ctx.globalAlpha = 1;
      } else if (p.kind === "feather") {
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 1);
        ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) - 1, 1, 1);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.globalAlpha = 1;
      }
    }
    for (var j = 0; j < this.pops.length; j++) this._drawPop(ctx, this.pops[j]);
  },

  _drawPop: function (ctx, p) {
    var t = p.t;
    /* Overshoot in, hold, then float up and fade. */
    var sc = t < 6 ? 0.4 + (t / 6) * 1.0 : t < 10 ? 1.4 - ((t - 6) / 4) * 0.4 : 1;
    var a = t < 30 ? 1 : 1 - (t - 30) / 12;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(Math.round(p.x), Math.round(p.y - Math.max(0, t - 10) * 0.5));
    ctx.rotate(p.rot);
    ctx.scale(sc, sc);
    ctx.font = "8px \"Press Start 2P\", monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a0e0a";
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 2; dy++) {
        if (dx || dy) ctx.fillText(p.text, dx, dy);
      }
    }
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
};

/* Words for each kind of hit. Plain cartoon sound effects. */
ER.HIT_WORDS = {
  bat: ["WHACK!", "THWACK!", "BOSH!"],
  kettle: ["BONK!", "CLONK!"],
  pan: ["CLANG!", "DONG!"],
  toaster: ["DONK!", "CLUNK!"],
  bottle: ["CLINK!", "BOINK!"],
  ball: ["THOK!", "WHAP!"],
  remote: ["BIP!", "TOK!"],
  pillow: ["FWUMP!", "PFFT!"],
  chair: ["CRASH!", "KRUNCH!"]
};
