/* A simple computer opponent — readable, a bit clumsy on purpose. */
window.ER = window.ER || {};

ER.AI = {
  think: function (self, other, items) {
    var cmd = { x: 0, y: 0, attack: false, pickup: false, jump: false };
    if (!self.alive || !other) return cmd;
    if (self.stun > 0) return cmd;

    /* Sometimes hop over something thrown at us. */
    var threat = ER.AI._incoming(self, items);
    if (threat && !self.airborne()) {
      if (threat.dodgeRoll === undefined) threat.dodgeRoll = Math.random() < 0.4;
      if (threat.dodgeRoll) cmd.jump = true;
    }

    var dx = other.x - self.x;
    var dy = other.y - self.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (self.kind === "eddie") {
      /* Close in and swing when nearby. */
      if (dist > 40) {
        cmd.x = dx > 4 ? 1 : dx < -4 ? -1 : 0;
        cmd.y = dy > 5 ? 1 : dy < -5 ? -1 : 0;
      } else {
        cmd.y = Math.abs(dy) > 6 ? (dy > 0 ? 1 : -1) : 0;
        if (dist > 30) cmd.x = dx > 0 ? 1 : -1;
      }
      if (dist < 46 && Math.abs(dy) < 18 && self.cooldown <= 0 && self.stun <= 0) {
        /* Small reaction delay so it is not frame-perfect. */
        if ((self.idleT % 18) > 6) cmd.attack = true;
      }
      /* Occasional pause so a human can land a throw. */
      if (self.idleT % 97 < 8) { cmd.x = 0; cmd.y = 0; }
      return cmd;
    }

    /* Richie: fetch something, then throw from a safer distance. */
    if (!self.holding) {
      var target = ER.AI._nearestGround(self, items);
      if (target) {
        var tx = target.x - self.x;
        var ty = target.y - self.y;
        var td = Math.sqrt(tx * tx + ty * ty);
        cmd.x = tx > 3 ? 1 : tx < -3 ? -1 : 0;
        cmd.y = ty > 4 ? 1 : ty < -4 ? -1 : 0;
        if (td < 30) cmd.pickup = true;
      } else {
        cmd.x = dx > 0 ? 1 : -1;
      }
      return cmd;
    }

    var prefer = 84;
    var toward = dx > 0 ? 1 : -1;
    if (dist < prefer - 18) {
      cmd.x = -toward; /* back off */
    } else if (dist > prefer + 24) {
      cmd.x = toward;
    }
    cmd.y = Math.abs(dy) > 8 ? (dy > 0 ? 1 : -1) : 0;
    /* Only throw when there is open floor between Richie and Eddie, never into a
       nearby wall (it would bounce back) and never point-blank. */
    var spec = ER.ITEM_SPEC[self.holding.type] || { radius: 10 };
    var wallGap = toward > 0 ? (ER.Game.level.worldW - self.x) : self.x;
    var clearShot = wallGap > spec.radius + 40;
    if (dist > 48 && dist < 150 && Math.abs(dy) < 22 && self.cooldown <= 0 && clearShot) {
      if ((self.idleT % 16) > 7) {
        /* Stop, turn to face Eddie, then throw. */
        cmd.x = 0;
        cmd.face = toward;
        cmd.attack = true;
      }
    }
    return cmd;
  },

  /* A flying object heading our way, close enough that a jump now would clear it. */
  _incoming: function (self, items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.state !== "fly" || it.thrower === self || it.hitUsed) continue;
      var dx = self.x - it.x;
      if (Math.abs(dx) < 18 || Math.abs(dx) > 64) continue;
      if ((dx > 0) !== (it.vx > 0)) continue;
      if (Math.abs(it.y - (self.y - 30)) > 30) continue;
      return it;
    }
    return null;
  },

  _nearestGround: function (self, items) {
    var best = null, bestD = 9999;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.state !== "ground") continue;
      var d = Math.abs(it.x - self.x) + Math.abs(it.y - self.y) * 0.6;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }
};
