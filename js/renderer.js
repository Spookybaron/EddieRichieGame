/* Draw the flat, people, objects, effects, the HUD and the round banners. */
window.ER = window.ER || {};

ER.COLORS = {
  eddie: "#ffd75a",
  eddieDark: "#b8892a",
  richie: "#ff6f8e",
  richieDark: "#a83a55",
  ink: "#1a0e0a",
  cream: "#fff3d6"
};

ER.Renderer = {
  numbers: [],
  shake: 0,
  hud: null,
  room: null,
  roomT: 0,

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

  /* Health bars drain smoothly, with a pale "chip" showing what was just lost. */
  resetHud: function (state) {
    this.hud = {
      eddie: { shown: state.eddie.hp, chip: state.eddie.hp, chipWait: 0, jolt: 0 },
      richie: { shown: state.richie.hp, chip: state.richie.hp, chipWait: 0, jolt: 0 }
    };
    this.room = null;
  },

  hudHit: function (kind) {
    if (!this.hud) return;
    this.hud[kind].chipWait = 26;
    this.hud[kind].jolt = 8;
  },

  _tickHud: function (state) {
    if (!this.hud) this.resetHud(state);
    ["eddie", "richie"].forEach(function (k) {
      var h = this.hud[k];
      var hp = state[k].hp;
      h.shown += (hp - h.shown) * 0.35;
      if (Math.abs(h.shown - hp) < 0.3) h.shown = hp;
      if (h.chipWait > 0) h.chipWait -= 1;
      else if (h.chip > hp) h.chip = Math.max(hp, h.chip - 1.1);
      if (h.chip < hp) h.chip = hp;
      if (h.jolt > 0) h.jolt -= 1;
    }, this);
  },

  draw: function (ctx, state) {
    ctx.imageSmoothingEnabled = false;
    this._tickHud(state);
    var camX = state.camX;
    var shx = 0, shy = 0;
    if (this.shake > 0) {
      shx = (Math.random() * 2 - 1) * this.shake * 0.6;
      shy = (Math.random() * 2 - 1) * this.shake * 0.4;
      this.shake *= 0.8;
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
      else this._drawPlayer(ctx, d.pl, state);
    }
    ER.FX.draw(ctx);

    ctx.restore();

    /* A red pulse at the screen edges when the player is nearly out. */
    this._drawDanger(ctx, state);
    if (state.screen !== "title") {
      this._drawHud(ctx, state);
      this._drawRoom(ctx, state);
    }
    this._drawFloats(ctx, camX);
    if (state.screen === "play" || state.screen === "pause") this._drawBanner(ctx, state);
  },

  _shadow: function (ctx, x, y, w, lift) {
    var k = 1 / (1 + Math.max(0, -(lift || 0)) / 28);
    ctx.save();
    ctx.fillStyle = "rgba(20,12,8," + (0.3 * k).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(x, y - 1, w * k, 4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* Work out the squash, stretch, lean and bounce for this frame. */
  _pose: function (pl, state) {
    var t = state.t || 0;
    var sp = Math.sqrt(pl.vx * pl.vx + pl.vy * pl.vy);
    var m = ER.clamp(sp / pl.speed, 0, 1);
    var sx = 1, sy = 1, rot = 0, oy = pl.z || 0;
    var f = pl.facing;

    if (!pl.alive) {
      /* Spin back from the hit, then flop. */
      var fall = Math.min(1, pl.koT / 16);
      rot = pl.knockDir * fall * 0.28;
      if (pl.landT > 0) { sy *= 1 - pl.landT * 0.025; sx *= 1 + pl.landT * 0.02; }
      return { sx: sx, sy: sy, rot: rot, oy: oy };
    }

    var air = pl.airborne();
    if (air) {
      /* Stretch on the way up, tuck at the top. */
      sy *= pl.vz < -1 ? 1.07 : pl.vz < 1 ? 0.97 : 1.02;
      sx *= pl.vz < -1 ? 0.94 : pl.vz < 1 ? 1.03 : 0.99;
      rot += ER.clamp(pl.vx / pl.speed, -1, 1) * 0.1;
    } else if (sp > 0.35 && pl.stun <= 0) {
      var ph = Math.abs(Math.sin(pl.walkPhase / 16 * Math.PI));
      oy -= ph * 2.4 * m;
      sy *= 1 - 0.045 * m * (1 - ph);
      sx *= 1 + 0.035 * m * (1 - ph);
      rot += ER.clamp(pl.vx / pl.speed, -1, 1) * 0.07;
    } else {
      /* Breathing. Richie is a bit twitchier than Eddie. */
      var rate = pl.kind === "richie" ? 15 : 22;
      var b = Math.sin(t / rate + (pl.kind === "richie" ? 1.7 : 0));
      sy *= 1 + b * 0.022;
      sx *= 1 - b * 0.012;
    }

    var a = pl.action;
    if (a && a.type === "swing") {
      var S = ER.EDDIE_SWING;
      if (a.t < S.windup) {
        var k = a.t / S.windup;
        sx *= 1 - 0.08 * k;
        sy *= 1 + 0.06 * k;
        rot -= 0.16 * k * f;
      } else {
        var e = Math.max(0, 1 - (a.t - S.windup) / (S.active + 6));
        sx *= 1 + 0.12 * e;
        sy *= 1 - 0.07 * e;
        rot += 0.18 * e * f;
      }
    } else if (a && a.type === "throw") {
      var w = a.windup || ER.RICHIE_THROW.windup;
      if (!a.released) {
        var kw = a.t / w;
        rot -= 0.18 * kw * f;
        sy *= 1 + 0.05 * kw;
        sx *= 1 - 0.05 * kw;
      } else {
        var er = Math.max(0, 1 - (a.t - w) / 10);
        rot += 0.2 * er * f;
        sx *= 1 + 0.1 * er;
        sy *= 1 - 0.05 * er;
      }
    }

    if (pl.stun > 0) {
      var ks = pl.stun / 16;
      rot += pl.knockDir * 0.22 * ks;
      sx *= 1 + 0.07 * ks;
      sy *= 1 - 0.07 * ks;
    }
    if (pl.turnT > 0) sx *= 1 - (pl.turnT / 6) * 0.3;
    if (pl.landT > 0) { sy *= 1 - pl.landT * 0.02; sx *= 1 + pl.landT * 0.016; }
    return { sx: sx, sy: sy, rot: rot, oy: oy };
  },

  _drawPlayer: function (ctx, pl, state) {
    var name = pl.animName();
    var flip = pl.facing < 0;
    this._shadow(ctx, pl.x, pl.y, 14, pl.z);

    /* After-images in the character's colour. */
    var ghostImg = ER.Sprites.tinted(pl.kind, ER.COLORS[pl.kind]);
    for (var g = 0; g < pl.ghosts.length; g++) {
      var gh = pl.ghosts[g];
      ctx.globalAlpha = 0.28 * (1 - gh.t / 10);
      ER.Sprites.draw(ctx, pl.kind, gh.name, gh.x, gh.y, gh.flip, 1, ghostImg);
    }
    ctx.globalAlpha = 1;

    var p = this._pose(pl, state);
    ctx.save();
    ctx.translate(Math.round(pl.x), Math.round(pl.y + p.oy));
    ctx.rotate(p.rot);
    ctx.scale(p.sx, p.sy);

    var img = null;
    if (pl.flash > 6) img = ER.Sprites.tinted(pl.kind, "#ffffff");
    else if (pl.iframes > 0 && pl.flash <= 0 && pl.alive && Math.floor(pl.iframes / 3) % 2 === 0) ctx.globalAlpha = 0.6;
    ER.Sprites.draw(ctx, pl.kind, name, 0, 0, flip, 1, img);
    if (pl.flash > 0 && pl.flash <= 6) {
      ctx.globalAlpha = 0.45;
      ER.Sprites.draw(ctx, pl.kind, name, 0, 0, flip, 1, ER.Sprites.tinted(pl.kind, "#ff3b3b"));
    }
    ctx.globalAlpha = 1;
    /* Drawn inside the body's transform so the bat leans and squashes with him. */
    this._drawBatSwing(ctx, pl);
    ctx.restore();

    if (pl.holding) {
      var bob = Math.sin((state.t || 0) / 10) * 0.8;
      pl.holding.y += p.oy + bob;
      this._drawItem(ctx, pl.holding);
      pl.holding.y -= p.oy + bob;
    }

    /* Little stars circling a knocked-out head. */
    if (!pl.alive && pl.koT > 20) {
      for (var s = 0; s < 3; s++) {
        var ang = (state.t || 0) / 9 + s * (Math.PI * 2 / 3);
        var hx = pl.x + Math.cos(ang) * 10 + pl.knockDir * 6;
        var hy = pl.y - 46 + Math.sin(ang) * 3 + p.oy;
        ctx.fillStyle = s === 1 ? "#ffffff" : "#ffe14a";
        ctx.fillRect(Math.round(hx) - 1, Math.round(hy), 3, 1);
        ctx.fillRect(Math.round(hx), Math.round(hy) - 1, 1, 3);
      }
    }
  },

  /* A little pixel cricket bat (same colours as the one in Eddie's wind-up
     frame), built once so it can be rotated without going blurry. */
  _batImage: function () {
    if (this._bat) return this._bat;
    var c = document.createElement("canvas");
    c.width = 34;
    c.height = 7;
    var g = c.getContext("2d");
    var ink = "#060002";
    /* Handle (grip) */
    g.fillStyle = ink;
    g.fillRect(0, 2, 10, 3);
    g.fillStyle = "#5b1538";
    g.fillRect(1, 3, 8, 1);
    /* Blade */
    g.fillStyle = ink;
    g.fillRect(9, 0, 25, 7);
    g.fillStyle = "#fcc375";
    g.fillRect(10, 1, 23, 5);
    g.fillStyle = "#ac7b5a";
    g.fillRect(10, 5, 23, 1);
    g.fillStyle = "#fff0c8";
    g.fillRect(11, 1, 20, 1);
    g.fillStyle = ink;
    g.fillRect(33, 0, 1, 1);
    g.fillRect(33, 6, 1, 1);
    this._bat = c;
    return c;
  },

  /* The bat sweeps from over Eddie's head, down through the hit, and
     follows through low. The swish smear shows while it can connect. */
  _drawBatSwing: function (ctx, pl) {
    var a = pl.action;
    if (!a || a.type !== "swing") return;
    var S = ER.EDDIE_SWING;
    var t = a.t - S.windup;
    if (t < 0) return; /* wind-up: the bat is already in the sprite, cocked back */
    var START = -1.95, HIT = 0.75, REST = 1.05;
    var ang;
    if (t < S.active) {
      var k = t / S.active;
      var e = 1 - Math.pow(1 - k, 3); /* fast, then slows into the follow-through */
      ang = START + (HIT - START) * e;
    } else {
      var kr = Math.min(1, (t - S.active) / S.recover);
      ang = HIT + (REST - HIT) * kr;
    }
    var fade = t < S.active ? 1 : Math.max(0, 1 - (t - S.active) / 8);
    ctx.save();
    if (pl.facing < 0) ctx.scale(-1, 1);
    ctx.translate(20, -35); /* Eddie's hand on the arm-out frame */

    if (fade > 0) {
      ctx.lineCap = "round";
      var from = Math.max(START, ang - 1.5);
      ctx.strokeStyle = "rgba(255,248,220," + (0.8 * fade).toFixed(3) + ")";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, from, ang);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,215,90," + (0.45 * fade).toFixed(3) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 32, from + 0.25, ang);
      ctx.stroke();
    }

    var img = this._batImage();
    ctx.rotate(ang);
    ctx.imageSmoothingEnabled = false;
    if (pl.flash > 6) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-3, -3, 34, 7);
    } else {
      ctx.drawImage(img, -3, -3);
    }
    ctx.restore();
  },

  _drawItem: function (ctx, it) {
    var spec = ER.ITEM_SPEC[it.type] || { scale: 0.4 };
    var sc = spec.scale;
    if (it.state === "held") sc *= 0.85;
    var lift = it.state === "fly" ? it.y - ER.FLOOR_BOTTOM : 0;
    this._shadow(ctx, it.x, it.state === "fly" ? Math.max(it.y + 18, Math.min(ER.FLOOR_BOTTOM, it.y + 40)) : it.y, 8, lift);
    /* Motion trail while it's in the air. */
    if (it.state === "fly" && it.trail) {
      for (var i = 0; i < it.trail.length; i++) {
        var tr = it.trail[i];
        ctx.save();
        ctx.globalAlpha = 0.08 + i * 0.05;
        ctx.translate(Math.round(tr.x), Math.round(tr.y));
        ctx.rotate(tr.a || 0);
        ER.Sprites.draw(ctx, "objects", it.type, 0, 0, false, sc);
        ctx.restore();
      }
    }
    /* Things on the floor have a gentle glint so you can spot them. */
    var glint = it.state === "ground" && ((it.life + it.homeX) % 150) < 10;
    ctx.save();
    ctx.translate(Math.round(it.x), Math.round(it.y));
    ctx.rotate(it.angle || 0);
    ER.Sprites.draw(ctx, "objects", it.type, 0, 0, false, sc);
    if (glint) {
      ctx.globalAlpha = 0.55;
      ER.Sprites.draw(ctx, "objects", it.type, 0, 0, false, sc, ER.Sprites.tinted("objects", "#fff8dc"));
    }
    ctx.restore();
  },

  _font: function (ctx, size) {
    ctx.font = size + "px \"Press Start 2P\", monospace";
  },

  _fit: function (ctx, text, maxW, size) {
    var s = size;
    this._font(ctx, s);
    while (s > 5 && ctx.measureText(text).width > maxW) {
      s -= 1;
      this._font(ctx, s);
    }
    return s;
  },

  /* Text with a thick dark outline, like an arcade cabinet. */
  _outlined: function (ctx, text, x, y, fill, outline, thick) {
    var o = thick || 1;
    ctx.fillStyle = outline || ER.COLORS.ink;
    for (var dx = -o; dx <= o; dx++) {
      for (var dy = -o; dy <= o + 1; dy++) {
        if (dx || dy) ctx.fillText(text, x + dx, y + dy);
      }
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  },

  _drawHud: function (ctx, state) {
    var SAFE = 5;
    var PORT = 22;
    var BAR_W = 112;
    var BAR_H = 9;
    var barY = SAFE + 9;
    var t = state.t || 0;

    ctx.save();
    var grd = ctx.createLinearGradient(0, 0, 0, 40);
    grd.addColorStop(0, "rgba(16,10,8,0.82)");
    grd.addColorStop(1, "rgba(16,10,8,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, ER.VIEW_W, 40);
    ctx.textBaseline = "top";

    var sides = [
      { kind: "eddie", px: SAFE, bx: SAFE + PORT + 4, left: true },
      { kind: "richie", px: ER.VIEW_W - SAFE - PORT, bx: ER.VIEW_W - SAFE - PORT - 4 - BAR_W, left: false }
    ];
    sides.forEach(function (sd) {
      var pl = state[sd.kind];
      var h = this.hud[sd.kind];
      var jx = h.jolt > 0 ? (h.jolt % 2 ? 1 : -1) : 0;

      /* Portrait in a coloured frame. */
      ctx.fillStyle = ER.COLORS.ink;
      ctx.fillRect(sd.px - 1 + jx, SAFE - 1, PORT + 2, PORT + 2);
      ctx.fillStyle = h.jolt > 4 ? "#ffffff" : ER.COLORS[sd.kind];
      ctx.fillRect(sd.px + jx, SAFE, PORT, PORT);
      ctx.fillStyle = "#2a1a14";
      ctx.fillRect(sd.px + 2 + jx, SAFE + 2, PORT - 4, PORT - 4);
      ctx.save();
      ctx.beginPath();
      ctx.rect(sd.px + 2 + jx, SAFE + 2, PORT - 4, PORT - 4);
      ctx.clip();
      ER.Sprites.portrait(ctx, sd.kind, sd.px + 1 + jx, SAFE + 2, PORT - 2, !sd.left);
      if (!pl.alive) {
        /* Knocked out: dim the face and cross it out. */
        ctx.fillStyle = "rgba(20,12,10,0.55)";
        ctx.fillRect(sd.px + 2 + jx, SAFE + 2, PORT - 4, PORT - 4);
        ctx.strokeStyle = "#ff4a4a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sd.px + 5, SAFE + 5); ctx.lineTo(sd.px + PORT - 5, SAFE + PORT - 5);
        ctx.moveTo(sd.px + PORT - 5, SAFE + 5); ctx.lineTo(sd.px + 5, SAFE + PORT - 5);
        ctx.stroke();
      }
      ctx.restore();

      /* Name. */
      this._font(ctx, 6);
      ctx.textAlign = sd.left ? "left" : "right";
      this._outlined(ctx, pl.maxHp ? ER.STATS[sd.kind].name : "", sd.left ? sd.bx : sd.bx + BAR_W, SAFE, "#fff8e8");

      /* Bar: frame, chip, live health. Both drain away from the middle. */
      this._bar(ctx, sd.bx + jx, barY, BAR_W, BAR_H, h.chip / pl.maxHp, h.shown / pl.maxHp, sd.kind, sd.left, t);

      /* Round wins. */
      for (var i = 0; i < ER.ROUNDS_TO_WIN; i++) {
        var won = state.wins && state.wins[sd.kind] > i;
        var cx = sd.left ? sd.bx + BAR_W - 4 - i * 9 : sd.bx + 4 + i * 9;
        var cy = barY + BAR_H + 6;
        ctx.fillStyle = ER.COLORS.ink;
        ctx.fillRect(cx - 3, cy - 3, 7, 7);
        ctx.fillStyle = won ? "#ffe14a" : "#4a3a30";
        ctx.fillRect(cx - 2, cy - 2, 5, 5);
        if (won) { ctx.fillStyle = "#fffbe0"; ctx.fillRect(cx - 1, cy - 1, 1, 1); }
      }
    }, this);

    /* Round number in the middle. */
    ctx.textAlign = "center";
    this._font(ctx, 5);
    this._outlined(ctx, "ROUND", ER.VIEW_W / 2, SAFE + 2, "#d8c4a4");
    this._font(ctx, 10);
    this._outlined(ctx, String(state.round || 1), ER.VIEW_W / 2, SAFE + 10, "#ffe14a");
    ctx.restore();
    ctx.textAlign = "left";
  },

  _bar: function (ctx, x, y, w, h, chipFrac, frac, kind, fromRight, t) {
    chipFrac = ER.clamp(chipFrac, 0, 1);
    frac = ER.clamp(frac, 0, 1);
    var inner = w - 4;
    ctx.fillStyle = ER.COLORS.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#f0e2c4";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#2a1c18";
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    var cw = Math.floor(inner * chipFrac);
    var lw = Math.floor(inner * frac);
    var ax = function (len) { return fromRight ? x + 2 + inner - len : x + 2; };
    ctx.fillStyle = "#fff4d0";
    ctx.fillRect(ax(cw), y + 2, cw, h - 4);
    var low = frac < 0.3;
    var pulse = low && Math.floor(t / 8) % 2 === 0;
    ctx.fillStyle = pulse ? "#ff4040" : (low ? "#ff7a3a" : ER.COLORS[kind]);
    ctx.fillRect(ax(lw), y + 2, lw, h - 4);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(ax(lw), y + 2, lw, 1);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(ax(lw), y + h - 3, lw, 1);
    /* Segment ticks every 10%. */
    ctx.fillStyle = "rgba(26,14,10,0.35)";
    for (var i = 1; i < 10; i++) ctx.fillRect(x + 2 + Math.round(inner * i / 10), y + 2, 1, h - 4);
  },

  /* The room name slides in whenever the fight moves into a new room. */
  _drawRoom: function (ctx, state) {
    if (!state.level || !state.level.roomAt) return;
    var room = state.level.roomAt(state.camX + ER.VIEW_W / 2);
    if (!room) return;
    if (room !== this.room) { this.room = room; this.roomT = 0; }
    this.roomT += 1;
    var t = this.roomT;
    if (t > 130) return;
    var slide = t < 12 ? (1 - t / 12) : t > 110 ? (t - 110) / 20 : 0;
    var label = room.name.toUpperCase();
    ctx.save();
    this._fit(ctx, label, 120, 6);
    var rw = Math.ceil(ctx.measureText(label).width) + 18;
    var rh = 13;
    var rx = Math.round((ER.VIEW_W - rw) / 2);
    var ry = Math.round(ER.VIEW_H - 6 - rh + slide * 22);
    ctx.fillStyle = "rgba(16,10,8,0.7)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "#ffe14a";
    ctx.fillRect(rx, ry, 3, rh);
    ctx.fillRect(rx + rw - 3, ry, 3, rh);
    ctx.fillStyle = "#f0e2c4";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, ER.VIEW_W / 2, ry + 4);
    ctx.restore();
  },

  _drawDanger: function (ctx, state) {
    if (state.screen !== "play" || !state.mode || state.mode === "2p") return;
    var me = state.mode === "1p-richie" ? state.richie : state.eddie;
    if (!me || !me.alive || me.hp / me.maxHp > 0.25) return;
    var a = 0.18 + Math.sin((state.t || 0) / 7) * 0.1;
    var g = ctx.createRadialGradient(ER.VIEW_W / 2, ER.VIEW_H / 2, ER.VIEW_H * 0.45, ER.VIEW_W / 2, ER.VIEW_H / 2, ER.VIEW_W * 0.62);
    g.addColorStop(0, "rgba(255,30,30,0)");
    g.addColorStop(1, "rgba(255,30,30," + a.toFixed(3) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ER.VIEW_W, ER.VIEW_H);
  },

  /* ROUND 1 / FIGHT! at the start, K.O.! at the end. */
  _drawBanner: function (ctx, state) {
    var cx = ER.VIEW_W / 2;
    var cy = Math.round(ER.VIEW_H * 0.42);
    var t = state.phaseT;
    var text = null, size = 16, fill = "#ffe14a", sc = 1, dx = 0, strip = 0, sub = null;

    if (state.phase === "intro") {
      if (t < 58) {
        text = state.isFinalRound && state.isFinalRound() ? "FINAL ROUND" : "ROUND " + state.round;
        size = 14;
        fill = "#fff3d6";
        dx = t < 12 ? -(1 - t / 12) * 260 : t > 48 ? ((t - 48) / 10) * 260 : 0;
        strip = Math.min(1, t / 8) * (t > 50 ? Math.max(0, 1 - (t - 50) / 8) : 1);
        if (state.wins && (state.wins.eddie || state.wins.richie)) sub = "EDDIE " + state.wins.eddie + "  -  " + state.wins.richie + " RICHIE";
      } else {
        var k = t - 58;
        text = "FIGHT!";
        size = 24;
        fill = "#ff6f4a";
        sc = k < 6 ? 2.2 - (k / 6) * 1.2 : 1;
        strip = k < 20 ? 1 : Math.max(0, 1 - (k - 20) / 6);
        if (k < 3) {
          ctx.fillStyle = "rgba(255,255,255," + (0.5 - k * 0.15).toFixed(3) + ")";
          ctx.fillRect(0, 0, ER.VIEW_W, ER.VIEW_H);
        }
      }
    } else if (state.phase === "ko") {
      if (t < 4) {
        ctx.fillStyle = "rgba(255,255,255," + (0.7 - t * 0.15).toFixed(3) + ")";
        ctx.fillRect(0, 0, ER.VIEW_W, ER.VIEW_H);
      }
      text = state.koWinner === "draw" ? "DOUBLE K.O.!" : "K.O.!";
      size = state.koWinner === "draw" ? 16 : 28;
      fill = "#ff4a4a";
      sc = t < 8 ? 2.4 - (t / 8) * 1.4 : 1 + Math.sin(t / 6) * 0.03;
      strip = Math.min(1, t / 6);
      if (t > 60 && state.koWinner !== "draw") {
        sub = ER.STATS[state.koWinner].name + " TAKES THE ROUND";
      }
    }
    if (!text) return;

    ctx.save();
    if (strip > 0) {
      var sh = Math.round(34 * strip);
      ctx.fillStyle = "rgba(16,10,8,0.62)";
      ctx.fillRect(0, cy - sh / 2, ER.VIEW_W, sh);
      ctx.fillStyle = "rgba(255,225,74," + (0.8 * strip).toFixed(3) + ")";
      ctx.fillRect(0, cy - sh / 2, ER.VIEW_W, 1);
      ctx.fillRect(0, cy + sh / 2 - 1, ER.VIEW_W, 1);
    }
    ctx.translate(Math.round(cx + dx), cy);
    ctx.scale(sc, sc);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this._fit(ctx, text, 300 / sc, size);
    this._outlined(ctx, text, 0, 1, fill, ER.COLORS.ink, 2);
    ctx.restore();
    if (sub) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this._fit(ctx, sub, 280, 6);
      this._outlined(ctx, sub, cx, cy + 26, "#fff3d6");
      ctx.restore();
    }
  },

  _drawFloats: function (ctx, camX) {
    var next = [];
    for (var i = 0; i < this.numbers.length; i++) {
      var n = this.numbers[i];
      n.t += 1;
      var sx = ER.clamp(n.x - camX, 16, ER.VIEW_W - 16);
      var sy = ER.clamp(n.y - n.t * 0.6, 44, ER.VIEW_H - 18);
      ctx.globalAlpha = Math.max(0, 1 - n.t / 40);
      this._fit(ctx, n.text, 80, 8);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this._outlined(ctx, n.text, sx, sy, n.color);
      ctx.globalAlpha = 1;
      if (n.t < 40) next.push(n);
    }
    this.numbers = next;
    ctx.textAlign = "left";
  }
};
