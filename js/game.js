/* Title, fight, pause, and win screens. */
window.ER = window.ER || {};

ER.Game = {
  screen: "title",
  mode: null,
  level: null,
  eddie: null,
  richie: null,
  players: [],
  items: [],
  camX: 320,
  winner: null,
  winT: 0,
  attractT: 0,

  init: function () {
    this.level = ER.getLevel("flat");
    this._spawnAttract();
    this._bindUi();
    ER.Audio.loadMute();
    this._syncMuteButton();
  },

  _spawnAttract: function () {
    var L = this.level;
    this.eddie = new ER.Player("eddie", L.start.eddie.x, L.start.eddie.y, L.start.eddie.facing, "none");
    this.richie = new ER.Player("richie", L.start.richie.x, L.start.richie.y, L.start.richie.facing, "none");
    this.players = [this.eddie, this.richie];
    this.items = L.itemSpawns.map(function (s) { return new ER.Item(s.type, s.x, s.y); });
    this.camX = 280;
    this.winner = null;
    this.winT = 0;
  },

  start: function (mode) {
    this.mode = mode;
    this.screen = "play";
    this.winner = null;
    this.winT = 0;
    var L = this.level;
    var eddieCtrl = "cpu";
    var richieCtrl = "cpu";
    if (mode === "1p-eddie") { eddieCtrl = "p1"; richieCtrl = "cpu"; }
    else if (mode === "1p-richie") { richieCtrl = "p1"; eddieCtrl = "cpu"; }
    else if (mode === "2p") { eddieCtrl = "p1"; richieCtrl = "p2"; }
    this.eddie = new ER.Player("eddie", L.start.eddie.x, L.start.eddie.y, L.start.eddie.facing, eddieCtrl);
    this.richie = new ER.Player("richie", L.start.richie.x, L.start.richie.y, L.start.richie.facing, richieCtrl);
    this.players = [this.eddie, this.richie];
    this.items = L.itemSpawns.map(function (s) { return new ER.Item(s.type, s.x, s.y); });
    this.camX = (this.eddie.x + this.richie.x) / 2 - ER.VIEW_W / 2;
    ER.Renderer.numbers = [];
    this.hitLog = [];
    this._show("title-screen", false);
    this._show("pause-screen", false);
    this._show("win-screen", false);
    this._setTouchVisible(mode !== "2p");
    ER.fitStage();
    ER.Audio.ui();
  },

  gotoTitle: function () {
    this.screen = "title";
    this.mode = null;
    this._spawnAttract();
    this._show("title-screen", true);
    this._show("pause-screen", false);
    this._show("win-screen", false);
    this._setTouchVisible(false);
    ER.fitStage();
  },

  togglePause: function () {
    if (this.screen === "play") {
      this.screen = "pause";
      this._show("pause-screen", true);
      ER.Audio.ui();
    } else if (this.screen === "pause") {
      this.screen = "play";
      this._show("pause-screen", false);
      ER.Audio.ui();
    }
  },

  toggleMute: function () {
    ER.Audio.setMuted(!ER.Audio.muted);
    this._syncMuteButton();
    if (!ER.Audio.muted) ER.Audio.ui();
  },

  _syncMuteButton: function () {
    document.querySelectorAll("[data-mute-label]").forEach(function (el) {
      el.textContent = ER.Audio.muted ? "Sound: off" : "Sound: on";
    });
  },

  _show: function (id, on) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = !on;
    el.setAttribute("aria-hidden", on ? "false" : "true");
  },

  _setTouchVisible: function (want) {
    var el = document.getElementById("touch");
    if (!el) return;
    var narrow = window.innerWidth <= 720;
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var show = !!(want && (narrow || coarse || window.innerHeight > window.innerWidth));
    el.hidden = !show;
    document.body.classList.toggle("has-touch", show);
    if (show) {
      var playingRichie = this.mode === "1p-richie";
      var a = el.querySelector("[data-touch='attack'] .label");
      var b = el.querySelector("[data-touch='pickup'] .label");
      if (a) a.textContent = playingRichie ? "THROW" : "BAT";
      if (b) b.textContent = playingRichie ? "PICK UP" : "GRAB\nTHROW";
      el.querySelector("[data-touch='pickup']").style.visibility = "visible";
    }
  },

  _bindUi: function () {
    var self = this;
    document.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        ER.Audio.unlock();
        self.start(btn.getAttribute("data-mode"));
      });
    });
    document.querySelectorAll("[data-action='resume']").forEach(function (btn) {
      btn.addEventListener("click", function () { self.togglePause(); });
    });
    document.querySelectorAll("[data-action='quit']").forEach(function (btn) {
      btn.addEventListener("click", function () { self.gotoTitle(); });
    });
    document.querySelectorAll("[data-action='again']").forEach(function (btn) {
      btn.addEventListener("click", function () { if (self.mode) self.start(self.mode); });
    });
    document.querySelectorAll("[data-action='mute']").forEach(function (btn) {
      btn.addEventListener("click", function () { ER.Audio.unlock(); self.toggleMute(); });
    });
  },

  hitLog: [],

  onHit: function (victim, amount, fromX, source) {
    this.hitLog.push({ victim: victim.kind, amount: amount, source: source || "test" });
    if (this.hitLog.length > 200) this.hitLog.shift();
    ER.Renderer.bump(8);
    ER.Renderer.floatText(victim.x, victim.y - 58, "-" + amount, "#fff3c4");
  },

  update: function () {
    ER.Input.poll();
    if (ER.Input.mutePressed) this.toggleMute();

    if (this.screen === "title") {
      this.attractT += 1;
      this.camX = 200 + Math.sin(this.attractT / 180) * 160 + 80;
      this.camX = ER.clamp(this.camX, 0, this.level.worldW - ER.VIEW_W);
      this.eddie.idleT += 1;
      this.richie.idleT += 1;
      if (ER.Input.confirmPressed) this.start("1p-eddie");
      return;
    }

    if (this.screen === "pause") {
      if (ER.Input.pausePressed || ER.Input.confirmPressed) this.togglePause();
      return;
    }

    if (this.screen === "win") {
      this.winT += 1;
      this.eddie.idleT += 1;
      this.richie.idleT += 1;
      this._followCam();
      if (ER.Input.confirmPressed && this.mode) this.start(this.mode);
      return;
    }

    if (this.screen !== "play") return;
    if (ER.Input.pausePressed) { this.togglePause(); return; }

    var cmds = {};
    this.players.forEach(function (pl) {
      if (pl.control === "cpu") cmds[pl.kind] = ER.AI.think(pl, pl === ER.Game.eddie ? ER.Game.richie : ER.Game.eddie, ER.Game.items);
      else cmds[pl.kind] = ER.Input.forControl(pl.control);
    });

    this.eddie.update(cmds.eddie, this.items, this.level, this.richie);
    this.richie.update(cmds.richie, this.items, this.level, this.eddie);
    for (var i = 0; i < this.items.length; i++) this.items[i].update(this.players, this.level);
    this._followCam();
    this._checkWin();
  },

  _followCam: function () {
    var left = Math.min(this.eddie.x, this.richie.x) - 48;
    var right = Math.max(this.eddie.x, this.richie.x) + 48;
    var mid = (left + right) / 2;
    if (right - left > ER.VIEW_W) mid = (this.eddie.x + this.richie.x) / 2;
    var target = mid - ER.VIEW_W / 2;
    this.camX += (target - this.camX) * 0.12;
    this.camX = ER.clamp(this.camX, 0, this.level.worldW - ER.VIEW_W);
  },

  _checkWin: function () {
    if (this.winner) return;
    var eDead = !this.eddie.alive;
    var rDead = !this.richie.alive;
    if (!eDead && !rDead) return;
    if (eDead && rDead) this.winner = "draw";
    else this.winner = eDead ? "richie" : "eddie";
    this.screen = "win";
    this.winT = 0;
    var title = document.getElementById("win-title");
    var blurb = document.getElementById("win-blurb");
    if (this.winner === "eddie") {
      if (title) title.textContent = "EDDIE WINS";
      if (blurb) blurb.textContent = "One swing of the cricket bat too many.";
    } else if (this.winner === "richie") {
      if (title) title.textContent = "RICHIE WINS";
      if (blurb) blurb.textContent = "Never underestimate a well-aimed kettle.";
    } else {
      if (title) title.textContent = "IT'S A DRAW";
      if (blurb) blurb.textContent = "They took each other out. Very them.";
    }
    this._show("win-screen", true);
    ER.Audio.win();
  },

  snapshot: function () {
    return {
      screen: this.screen,
      mode: this.mode,
      camX: this.camX,
      eddie: { hp: this.eddie.hp, maxHp: this.eddie.maxHp, x: this.eddie.x, y: this.eddie.y, alive: this.eddie.alive, control: this.eddie.control },
      richie: { hp: this.richie.hp, maxHp: this.richie.maxHp, x: this.richie.x, y: this.richie.y, alive: this.richie.alive, control: this.richie.control },
      items: this.items.map(function (it) { return { type: it.type, x: it.x, y: it.y, state: it.state }; }),
      winner: this.winner
    };
  }
};

ER.Test = {
  start: function (mode) { ER.Game.start(mode); },
  gotoTitle: function () { ER.Game.gotoTitle(); },
  state: function () { return ER.Game.snapshot(); },
  damage: function (who, n) {
    var pl = ER.Game[who];
    if (!pl) return false;
    var other = who === "eddie" ? ER.Game.richie : ER.Game.eddie;
    var ok = pl.takeDamage(n, other.x);
    if (ok) ER.Game.onHit(pl, n, other.x);
    ER.Game._checkWin();
    return ok;
  },
  kill: function (who) {
    var pl = ER.Game[who];
    if (!pl) return;
    pl.iframes = 0;
    pl.takeDamage(999, pl.x - 10);
    ER.Game._checkWin();
  },
  /* Step the game logic n frames without waiting for the screen. */
  step: function (n) {
    for (var i = 0; i < n && ER.Game.screen === "play"; i++) ER.Game.update();
    return ER.Game.snapshot();
  },
  hits: function () { return ER.Game.hitLog.slice(); },
  move: function (who, x, y) {
    var pl = ER.Game[who];
    if (!pl) return;
    if (x != null) pl.x = x;
    if (y != null) pl.y = y;
  }
};
