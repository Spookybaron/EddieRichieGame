/* Players and household objects. */
window.ER = window.ER || {};

ER.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

ER.aabbHit = function (ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
};

ER.Player = function (kind, x, y, facing, control) {
  var st = ER.STATS[kind];
  this.kind = kind;
  this.x = x;
  this.y = y;
  this.facing = facing;
  this.vx = 0;
  this.vy = 0;
  this.hp = st.hp;
  this.maxHp = st.hp;
  this.speed = st.speed;
  this.accel = st.accel;
  this.friction = st.friction;
  this.control = control;
  this.holding = null;
  this.stun = 0;
  this.iframes = 0;
  this.cooldown = 0;
  this.action = null;
  this.walkPhase = 0;
  this.idleT = 0;
  this.flash = 0;
  this.alive = true;
  this.throwPower = st.throwPower || 1;
  this.throwDamage = st.throwDamage || 1;
};

ER.Player.prototype.hurtbox = function () {
  return { x: this.x - 11, y: this.y - 52, w: 22, h: 50 };
};

ER.Player.prototype.takeDamage = function (amount, fromX) {
  if (!this.alive || this.iframes > 0) return false;
  this.hp = Math.max(0, this.hp - amount);
  this.stun = 16;
  this.iframes = 28;
  this.flash = 10;
  this.vx += (this.x >= fromX ? 1 : -1) * (amount > 16 ? 2.6 : 1.8);
  this.action = null;
  if (this.hp <= 0) {
    this.alive = false;
    this.hp = 0;
  }
  return true;
};

ER.Player.prototype.tryPickup = function (items) {
  if (this.holding || this.stun > 0 || !this.alive) return false;
  var best = null;
  var bestD = 34;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.state !== "ground") continue;
    var dx = it.x - this.x;
    var dy = it.y - this.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var reach = it.type === "chair" ? 38 : 32;
    if (d < Math.min(bestD, reach + 1) && d < reach) {
      best = it;
      bestD = d;
    }
  }
  if (!best) return false;
  best.state = "held";
  best.holder = this;
  this.holding = best;
  ER.Audio.pickup();
  return true;
};

ER.Player.prototype.drop = function () {
  if (!this.holding) return;
  var it = this.holding;
  it.state = "ground";
  it.holder = null;
  it.x = this.x + this.facing * 16;
  it.y = this.y;
  it.vx = 0;
  it.vy = 0;
  this.holding = null;
  ER.Audio.drop();
};

ER.Player.prototype.startSwing = function () {
  if (this.kind !== "eddie") return;
  if (this.stun > 0 || this.cooldown > 0 || this.action) return;
  var s = ER.EDDIE_SWING;
  this.action = { type: "swing", t: 0, dur: s.windup + s.active + s.recover, hit: false };
  this.cooldown = s.windup + s.active + s.recover + s.cooldown;
  ER.Audio.swing();
};

ER.Player.prototype.startThrow = function () {
  if (!this.holding || this.stun > 0 || this.cooldown > 0 || this.action) return false;
  var s = ER.RICHIE_THROW;
  /* Eddie winds up a little slower than Richie. */
  var slow = this.kind === "eddie" ? 4 : 0;
  this.action = { type: "throw", t: 0, dur: s.windup + slow + s.recover, windup: s.windup + slow, released: false };
  this.cooldown = s.windup + slow + s.recover + s.cooldown;
  return true;
};

ER.Player.prototype.releaseThrow = function (aimY) {
  var it = this.holding;
  if (!it) return;
  var spec = ER.ITEM_SPEC[it.type];
  it.state = "fly";
  it.holder = null;
  /* Spawn the object fully clear of the thrower's own body (hurtbox half-width 11). */
  it.x = this.x + this.facing * (11 + spec.radius + 4);
  it.y = this.y - 30;
  /* Never let the thrower's own backwards drift push it back into them. */
  var drift = this.vx * this.facing > 0 ? this.vx * 0.25 : 0;
  it.vx = this.facing * spec.speed * this.throwPower + drift;
  it.vy = spec.vy * (this.throwPower < 1 ? 0.85 : 1) + (aimY || 0) * 0.9;
  it.spin = this.facing * (spec.heavy ? 0.12 : 0.22);
  it.hitUsed = false;
  it.damageMul = this.throwDamage;
  /* Owner immunity: an object can never hurt the person who threw it. */
  it.thrower = this;
  this.holding = null;
  ER.Audio.throw();
};

ER.Player.prototype.update = function (cmd, items, level, opponent) {
  if (this.iframes > 0) this.iframes -= 1;
  if (this.flash > 0) this.flash -= 1;
  if (this.cooldown > 0) this.cooldown -= 1;
  if (this.stun > 0) this.stun -= 1;

  if (!this.alive) {
    this.vx *= 0.8;
    this.x = ER.clamp(this.x + this.vx, 18, level.worldW - 18);
    this.y = ER.clamp(this.y, level.floorTop, level.floorBottom);
    return;
  }

  if (this.action) {
    this.action.t += 1;
    if (this.action.type === "swing") {
      var s = ER.EDDIE_SWING;
      if (!this.action.hit && this.action.t >= s.windup && this.action.t < s.windup + s.active) {
        this._tryBatHit(opponent);
      }
    }
    if (this.action.type === "throw" && !this.action.released && this.action.t >= (this.action.windup || ER.RICHIE_THROW.windup)) {
      this.action.released = true;
      this.releaseThrow(cmd ? cmd.y : 0);
    }
    if (this.action.t >= this.action.dur) this.action = null;
  }

  var busy = this.action && (this.action.type === "swing" || this.action.type === "throw");
  var canMove = this.stun <= 0 && !(busy && this.action.t < 16);

  if (canMove && cmd) {
    var mx = cmd.x, my = cmd.y;
    if (mx) this.facing = mx > 0 ? 1 : -1;
    this.vx += mx * this.accel;
    this.vy += my * this.accel * 0.72;
    var spd = this.speed;
    var mag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (mag > spd) {
      this.vx = (this.vx / mag) * spd;
      this.vy = (this.vy / mag) * spd;
    }
    if (Math.abs(mx) + Math.abs(my) > 0) this.walkPhase += 1;
    if (cmd.face) this.facing = cmd.face;
    if (cmd.attack) {
      /* Eddie: F always swings the bat. Richie: K throws (or grabs if empty-handed). */
      if (this.kind === "eddie") this.startSwing();
      else if (this.holding) this.startThrow();
      else this.tryPickup(items);
    }
    if (cmd.pickup) {
      /* Eddie: G grabs, then G again throws. Richie: L picks up / drops. */
      if (this.holding) {
        if (this.kind === "eddie") this.startThrow();
        else this.drop();
      } else {
        this.tryPickup(items);
      }
    }
  }

  if (!cmd || (!cmd.x && !cmd.y) || !canMove) {
    this.vx *= this.friction;
    this.vy *= this.friction;
  }

  this.x += this.vx;
  this.y += this.vy;
  this.x = ER.clamp(this.x, 18, level.worldW - 18);
  this.y = ER.clamp(this.y, level.floorTop, level.floorBottom);

  this._resolveChair(items);
  this.idleT += 1;
};

ER.Player.prototype._tryBatHit = function (opponent) {
  if (!opponent || !opponent.alive) return;
  var s = ER.EDDIE_SWING;
  var hx = this.facing > 0 ? this.x + 8 : this.x - 8 - s.range;
  var hy = this.y - 50;
  var box = opponent.hurtbox();
  if (ER.aabbHit(hx, hy, s.range, 40, box.x, box.y, box.w, box.h)) {
    if (Math.abs(opponent.y - this.y) < 22 && opponent.takeDamage(s.damage, this.x)) {
      this.action.hit = true;
      ER.Audio.hit();
      ER.Game.onHit(opponent, s.damage, this.x, "bat");
    }
  }
};

ER.Player.prototype._resolveChair = function (items) {
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.type !== "chair" || it.state !== "ground") continue;
    var hw = 16, hh = 10;
    if (Math.abs(this.x - it.x) < hw + 10 && Math.abs(this.y - it.y) < hh + 6) {
      if (this.x < it.x) this.x = it.x - hw - 10;
      else this.x = it.x + hw + 10;
    }
  }
};

ER.Player.prototype.animName = function () {
  if (!this.alive) return "lose";
  if (ER.Game && ER.Game.winner === this.kind) return "win";
  if (this.stun > 0) return "hurt";
  if (this.action && this.action.type === "swing") return "swing";
  if (this.action && this.action.type === "throw") {
    if (this.kind === "eddie") return this.action.released ? "jab" : "reach";
    return this.action.released ? "throw3" : "throw2";
  }
  if (Math.abs(this.vx) + Math.abs(this.vy) > 0.35) {
    var frame = Math.floor(this.walkPhase / 8) % 4;
    return "walk" + frame;
  }
  return (Math.floor(this.idleT / 50) % 6 === 5) ? "idle1" : "idle0";
};

ER.Item = function (type, x, y) {
  this.type = type;
  this.homeX = x;
  this.homeY = y;
  this.x = x;
  this.y = y;
  this.vx = 0;
  this.vy = 0;
  this.angle = 0;
  this.spin = 0;
  this.state = "ground"; /* ground | held | fly */
  this.holder = null;
  this.hitUsed = false;
  this.life = 0;
};

ER.Item.prototype.update = function (players, level) {
  this.life += 1;
  if (this.state === "held") {
    if (this.holder) {
      this.x = this.holder.x + this.holder.facing * 12;
      this.y = this.holder.y - 28;
      this.angle = 0;
    }
    return;
  }
  if (this.state === "ground") {
    this.vx *= 0.8;
    this.x += this.vx;
    this.x = ER.clamp(this.x, 14, level.worldW - 14);
    this.y = ER.clamp(this.y, level.floorTop - 8, level.floorBottom);
    this.angle *= 0.8;
    return;
  }
  if (this.state !== "fly") return;

  var spec = ER.ITEM_SPEC[this.type];
  this.vy += spec.gravity;
  this.x += this.vx;
  this.y += this.vy;
  this.angle += this.spin;

  if (this.x < 12 || this.x > level.worldW - 12) {
    this.x = ER.clamp(this.x, 12, level.worldW - 12);
    this.vx *= -0.4;
    this.spin *= -1;
  }

  if (!this.hitUsed) {
    for (var i = 0; i < players.length; i++) {
      var pl = players[i];
      if (!pl.alive) continue;
      /* Objects never damage whoever threw them, even after bouncing off a wall. */
      if (pl === this.thrower) continue;
      var box = pl.hurtbox();
      var r = spec.radius;
      var dmg = Math.round(spec.damage * (this.damageMul || 1));
      if (ER.aabbHit(this.x - r, this.y - r, r * 2, r * 2, box.x, box.y, box.w, box.h)) {
        if (Math.abs(pl.y - this.y) < 48 && pl.takeDamage(dmg, this.x)) {
          this.hitUsed = true;
          ER.Audio.hit();
          ER.Game.onHit(pl, dmg, this.x, this.thrower ? this.thrower.kind : "object");
          this.vx *= -0.25;
          this.vy = Math.min(this.vy, 0.4);
          break;
        }
      }
    }
  }

  if (this.y >= level.floorBottom) {
    this.y = level.floorBottom;
    if (spec.bounce && Math.abs(this.vy) > 1.1) {
      this.vy = -this.vy * spec.bounce;
      this.vx *= 0.8;
    } else {
      this.state = "ground";
      this.vx *= 0.4;
      this.vy = 0;
      this.spin = 0;
      this.thrower = null;
    }
  }
};
