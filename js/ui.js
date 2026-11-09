/* Little animated character previews on the title and results screens. */
window.ER = window.ER || {};

ER.UI = {
  hover: {},

  init: function () {
    var self = this;
    /* Fully hide the help text while it's folded away. */
    document.querySelectorAll("details.help").forEach(function (d) {
      var body = d.querySelector(".help-body");
      d.addEventListener("toggle", function () { if (body) body.hidden = !d.open; });
    });
    document.querySelectorAll(".fighter").forEach(function (card) {
      var kind = card.getAttribute("data-kind");
      var on = function () { self.hover[kind] = true; };
      var off = function () { self.hover[kind] = false; };
      card.addEventListener("mouseenter", on);
      card.addEventListener("focus", on);
      card.addEventListener("mouseleave", off);
      card.addEventListener("blur", off);
    });
  },

  /* Draw one character standing in a small canvas, with a bit of life. */
  _figure: function (canvas, kind, frame, t, opts) {
    var g = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    var scale = opts.scale || 1;
    var hopT = t % 60;
    var hop = opts.hop ? -Math.max(0, Math.sin(Math.min(1, hopT / 22) * Math.PI)) * 9 : 0;
    var land = opts.hop && hopT >= 22 && hopT < 30 ? 1 - (hopT - 22) / 8 : 0;
    var b = Math.sin(t / (kind === "richie" ? 15 : 22));
    var sy = (1 + b * 0.025) * (1 - land * 0.1);
    var sx = (1 - b * 0.012) * (1 + land * 0.08);
    var footY = H - 6;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(W / 2, footY, 14 * scale * (1 + hop / 30), 3 * scale, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(Math.round(W / 2), Math.round(footY + hop * scale));
    g.scale(sx * scale, sy * scale);
    ER.Sprites.draw(g, kind, frame, 0, 0, !!opts.flip, 1);
    g.restore();
  },

  draw: function (game) {
    if (!ER.Sprites.ready) return;
    var t = game.t || 0;
    var self = this;
    if (game.screen === "title") {
      document.querySelectorAll("canvas[data-preview]").forEach(function (c) {
        var kind = c.getAttribute("data-preview");
        var hot = !!self.hover[kind];
        var frame;
        if (hot) frame = "win";
        else if (Math.floor((t + (kind === "richie" ? 40 : 0)) / 50) % 6 === 5) frame = "idle1";
        else frame = "idle0";
        self._figure(c, kind, frame, t, { scale: 1, hop: hot, flip: kind === "richie" });
      });
    }
    if (game.screen === "win") {
      var c = document.getElementById("win-portrait");
      if (!c) return;
      if (game.winner === "draw") {
        var g = c.getContext("2d");
        g.clearRect(0, 0, c.width, c.height);
        return;
      }
      this._figure(c, game.winner, "win", t, { scale: 1, hop: true, flip: game.winner === "richie" });
    }
  }
};
