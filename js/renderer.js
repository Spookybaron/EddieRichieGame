/* Draw the flat, people, objects, and the health bars. */
window.ER = window.ER || {};

ER.Renderer = {
  numbers: [],
  shake: 0,

  bump: function (n) {
    this.shake = Math.max(this.shake, n || 6);
  },

  floatText: function (x, y, text, color) {
    this.numbers.push({ x: x, y: y, text: text, color: color || "#fff3c4", t: 0 });
  },

  resizeCanvas: function (canvas) {
    canvas.width = ER.VIEW_W;
    canvas.height = ER.VIEW_H;
  },

  draw: function (ctx, state) {
    ctx.imageSmoothingEnabled = false;
    var camX = state.camX;
    var shx = 0, shy = 0;
    if (this.shake > 0) {
      shx = (Math.random() * 2 - 1) * this.shake * 0.6;
      shy = (Math.random() * 2 - 1) * this.shake * 0.4;
      this.shake *= 0.78;
      if (this.shake < 0.4) this.shake = 0;
    }
    ctx.save();
    ctx.translate(Math.round(-camX + shx), Math.round(shy));

    var flat = ER.Sprites.images.flat;
    if (flat) ctx.drawImage(flat, 0, 0);

    var drawList = [];
    state.items.forEach(function (it) {
      if (it.state !== "held") drawList.push({ y: it.y, kind: "item", it: it });
    });
    state.players.forEach(function (pl) {
      drawList.push({ y: pl.y, kind: "player", pl: pl });
    });
    drawList.sort(function (a, b) { return a.y - b.y; });

    for (var i = 0; i < drawList.length; i++) {
      var d = drawList[i];
      if (d.kind === "item") this._drawItem(ctx, d.it);
      else this._drawPlayer(ctx, d.pl);
    }

    ctx.restore();
    this._drawHud(ctx, state);
    this._drawFloats(ctx, camX);
  },

  _shadow: function (ctx, x, y, w) {
    ctx.save();
    ctx.fillStyle = "rgba(20,12,8,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y - 1, w, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawPlayer: function (ctx, pl) {
    this._shadow(ctx, pl.x, pl.y, 14);
    var name = pl.animName();
    if (pl.flash > 0 && pl.flash % 2 === 0) ctx.globalAlpha = 0.45;
    ER.Sprites.draw(ctx, pl.kind, name, pl.x, pl.y, pl.facing < 0, 1);
    ctx.globalAlpha = 1;
    if (pl.holding) {
      this._drawItem(ctx, pl.holding);
    }
  },

  _drawItem: function (ctx, it) {
    var spec = ER.ITEM_SPEC[it.type] || { scale: 0.4 };
    var sc = spec.scale;
    if (it.state === "held") sc *= 0.85;
    this._shadow(ctx, it.x, it.state === "fly" ? it.y + 18 : it.y, 8);
    ctx.save();
    ctx.translate(Math.round(it.x), Math.round(it.y));
    ctx.rotate(it.angle || 0);
    ER.Sprites.draw(ctx, "objects", it.type, 0, 0, false, sc);
    ctx.restore();
  },

  _fit: function (ctx, text, maxW, size) {
    var s = size;
    ctx.font = s + "px \"Press Start 2P\", monospace";
    while (s > 5 && ctx.measureText(text).width > maxW) {
      s -= 1;
      ctx.font = s + "px \"Press Start 2P\", monospace";
    }
    return s;
  },

  _drawHud: function (ctx, state) {
    var eddie = state.eddie;
    var richie = state.richie;
    ctx.fillStyle = "rgba(20,14,12,0.55)";
    ctx.fillRect(0, 0, ER.VIEW_W, 22);

    this._bar(ctx, 4, 8, 118, 8, eddie.hp / eddie.maxHp, "#d4b44a", "EDDIE", true);
    this._bar(ctx, ER.VIEW_W - 122, 8, 118, 8, richie.hp / richie.maxHp, "#d45a6a", "RICHIE", false);

    if (state.level && state.level.roomAt) {
      var room = state.level.roomAt(state.camX + ER.VIEW_W / 2);
      var label = room ? room.name.toUpperCase() : "";
      this._fit(ctx, label, 100, 6);
      ctx.fillStyle = "rgba(20,14,12,0.45)";
      ctx.fillRect(ER.VIEW_W / 2 - 52, ER.VIEW_H - 14, 104, 12);
      ctx.fillStyle = "#f0e2c4";
      ctx.textAlign = "center";
      ctx.fillText(label, ER.VIEW_W / 2, ER.VIEW_H - 5);
      ctx.textAlign = "left";
    }
  },

  _bar: function (ctx, x, y, w, h, frac, color, label, labelLeft) {
    frac = ER.clamp(frac, 0, 1);
    ctx.fillStyle = "#2a1c18";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.max(0, Math.floor((w - 2) * frac)), h - 2);
    ctx.strokeStyle = "#f0e2c4";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    this._fit(ctx, label, 70, 6);
    ctx.fillStyle = "#fff8e8";
    if (labelLeft) {
      ctx.textAlign = "left";
      ctx.fillText(label, x, y - 1);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, x + w, y - 1);
    }
    ctx.textAlign = "left";
  },

  _drawFloats: function (ctx, camX) {
    var next = [];
    for (var i = 0; i < this.numbers.length; i++) {
      var n = this.numbers[i];
      n.t += 1;
      var sx = n.x - camX;
      var sy = n.y - n.t * 0.6;
      if (sx < 4 || sx > ER.VIEW_W - 4) { /* keep on the view if we can */ }
      ctx.globalAlpha = Math.max(0, 1 - n.t / 40);
      this._fit(ctx, n.text, 80, 8);
      ctx.fillStyle = n.color;
      ctx.textAlign = "center";
      ctx.fillText(n.text, sx, sy);
      ctx.globalAlpha = 1;
      if (n.t < 40) next.push(n);
    }
    this.numbers = next;
    ctx.textAlign = "left";
  }
};
