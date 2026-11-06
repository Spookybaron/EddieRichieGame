/* A simple computer opponent — readable, a bit clumsy on purpose. */
window.ER = window.ER || {};

ER.AI = {
  think: function (self, other, items) {
    var cmd = { x: 0, y: 0, attack: false, pickup: false };
    if (!self.alive || !other) return cmd;
    if (self.stun > 0) return cmd;

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
    if (dist < prefer - 18) {
      cmd.x = dx > 0 ? -1 : 1; /* back off */
    } else if (dist > prefer + 24) {
      cmd.x = dx > 0 ? 1 : -1;
    }
    cmd.y = Math.abs(dy) > 8 ? (dy > 0 ? 1 : -1) : 0;
    if (dist > 48 && dist < 150 && Math.abs(dy) < 22 && self.cooldown <= 0) {
      if ((self.idleT % 16) > 7) cmd.attack = true;
    }
    return cmd;
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
