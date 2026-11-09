/* Title, rounds, fight, pause, and win screens. */
window.ER = window.ER || {};

ER.ROUNDS_TO_WIN = 2; /* best of three */

ER.Game = {
  screen: "title",   /* title | play | pause | win */
  phase: "fight",    /* inside play: intro | fight | ko */
  phaseT: 0,
  mode: null,
  level: null,
  eddie: null,
  richie: null,
  players: [],
  items: [],
  camX: 320,
  winner: null,      /* who won the whole match */
  koWinner: null,    /* who won the round that just ended */
  winT: 0,
  attractT: 0,
  attractRest: 0,
  t: 0,
  round: 1,
  wins: { eddie: 0, richie: 0 },
  stats: null,
  hitstop: 0,
  hitLog: [],

  init: function () {
    this.level = ER.getLevel("flat");
    this._spawnAttract();
    this._bindUi();
    ER.Audio.loadMute();
    this._syncMuteButton();
  },

  _freshStats: function () {
    return {
      eddie: { hits: 0, damage: 0, biggest: 0 },
      richie: { hits: 0, damage: 0, biggest: 0 }
    };
  },

  _spawnPlayers: function (eddieCtrl, richieCtrl) {
    var L = this.level;
    this.eddie = new ER.Player("eddie", L.start.eddie.x, L.start.eddie.y, L.start.eddie.facing, eddieCtrl);
    this.richie = new ER.Player("richie", L.start.richie.x, L.start.richie.y, L.start.richie.facing, richieCtrl);
    this.players = [this.eddie, this.richie];
    this.items = L.itemSpawns.map(function (s) { return new ER.Item(s.type, s.x, s.y); });
    if (ER.FX) ER.FX.clear();
    ER.Renderer.numbers = [];
  },

  /* Behind the title screen the two of them have a go at each other. */
  _spawnAttract: function () {
    this._spawnPlayers("cpu", "cpu");
    this.camX = 280;
    this.winner = null;
    this.koWinner = null;
    this.winT = 0;
    this.attractRest = 0;
    this.phase = "fight";
  },

  start: function (mode, opts) {
    opts = opts || {};
    this.mode = mode;
    this.screen = "play";
    this.winner = null;
    this.koWinner = null;
    this.winT = 0;
    this.round = 1;
    this.wins = { eddie: 0, richie: 0 };
    this.stats = this._freshStats();
    this.hitLog = [];
    this.hitstop = 0;
    this._startRound(!!opts.skipIntro);
    this._show("title-screen", false);
    this._show("pause-screen", false);
    this._show("win-screen", false);
    this._setTouchVisible(mode !== "2p");
    document.body.classList.add("playing");
    ER.fitStage();
    ER.Audio.ui();
  },

  _controls: function () {
    var m = this.mode;
    if (m === "1p-eddie") return ["p1", "cpu"];
    if (m === "1p-richie") return ["cpu", "p1"];
    if (m === "2p") return ["p1", "p2"];
    return ["cpu", "cpu"];
  },

  _startRound: function (skipIntro) {
    var c = this._controls();
    this._spawnPlayers(c[0], c[1]);
    this.camX = (this.eddie.x + this.richie.x) / 2 - ER.VIEW_W / 2;
    this.koWinner = null;
    this.phase = skipIntro ? "fight" : "intro";
    this.phaseT = 0;
    ER.Renderer.resetHud(this);
  },

  isFinalRound: function () {
    return this.wins.eddie === ER.ROUNDS_TO_WIN - 1 && this.wins.richie === ER.ROUNDS_TO_WIN - 1;
  },

  gotoTitle: function () {
    this.screen = "title";
    this.mode = null;
    this._spawnAttract();
    this._show("title-screen", true);
    this._show("pause-screen", false);
    this._show("win-screen", false);
    this._setTouchVisible(false);
    document.body.classList.remove("playing");
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
      if (b) b.textContent = playingRichie ? "PICK UP\nDROP" : "GRAB\nTHROW";
      el.classList.toggle("as-richie", playingRichie);
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
    document.querySelectorAll("[data-action='resume'], [data-action='pause']").forEach(function (btn) {
      btn.addEventListener("click", function () { ER.Audio.unlock(); self.togglePause(); });
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

  onHit: function (victim, amount, fromX, source, weapon) {
    this.hitLog.push({ victim: victim.kind, amount: amount, source: source || "test" });
    if (this.hitLog.length > 200) this.hitLog.shift();
    var attacker = victim.kind === "eddie" ? "richie" : "eddie";
    if (this.stats && this.screen === "play") {
      var st = this.stats[attacker];
      st.hits += 1;
      st.damage += amount;
      st.biggest = Math.max(st.biggest, amount);
    }
    /* A short freeze on impact sells the hit. Bigger hits freeze longer. */
    this.hitstop = Math.max(this.hitstop, amount >= 20 ? 6 : 4);
    ER.Renderer.bump(amount >= 20 ? 10 : 7);
    ER.Renderer.hudHit(victim.kind);
    ER.Renderer.floatText(victim.x, victim.y - 58, "-" + amount, "#fff3c4");
    var hy = victim.y - 34;
    var hx = victim.x - victim.knockDir * 6;
    ER.FX.stars(hx, hy, victim.kind === "eddie" ? "#ffd75a" : "#ff7a9a", amount >= 20 ? 14 : 10);
    if (weapon === "pillow") ER.FX.feathers(hx, hy);
    var words = ER.HIT_WORDS[weapon] || ["POW!"];
    /* The word goes beside the body, away from the damage number over the head. */
    ER.FX.pop(victim.x - victim.knockDir * 22, hy + 4, words[(this.hitLog.length) % words.length], amount >= 20 ? "#ffe14a" : "#fff3c4");
  },

  update: function () {
    this.t += 1;
    ER.Input.poll();
    ER.Audio.quiet = this.screen === "title";
    if (ER.Input.mutePressed) this.toggleMute();

    if (this.screen === "title") {
      this._updateAttract();
      if (ER.Input.confirmPressed) this.start("1p-eddie");
      return;
    }

    if (this.screen === "pause") {
      if (ER.Input.pausePressed || ER.Input.confirmPressed) this.togglePause();
      return;
    }

    if (this.screen === "win") {
      this.winT += 1;
      var w = this[this.winner];
      if (w && w.alive && this.winT % 46 === 1) w.hop(2.3);
      this._stepWorld(null);
      if (ER.Input.confirmPressed && this.mode && this.winT > 20) this.start(this.mode);
      return;
    }

    if (this.screen !== "play") return;
    if (ER.Input.pausePressed) { this.togglePause(); return; }

    if (this.hitstop > 0) {
      this.hitstop -= 1;
      return;
    }

    this.phaseT += 1;

    if (this.phase === "intro") {
      if (this.phaseT === 8) ER.Audio.bell();
      if (this.phaseT === 62) ER.Audio.fight();
      this._stepWorld(null);
      if (this.phaseT >= 84) { this.phase = "fight"; this.phaseT = 0; }
      return;
    }

    if (this.phase === "ko") {
      /* Slow motion for the first part of a knockout. */
      if (this.phaseT < 54 && this.phaseT % 3 !== 0) return;
      var kw = this[this.koWinner];
      if (kw && kw.alive && this.phaseT > 60 && this.phaseT % 40 === 0) kw.hop(2.1);
      this._stepWorld(null);
      if (this.phaseT >= 150) this._endKo();
      return;
    }

    var cmds = this._commands();
    this._stepWorld(cmds);
    this._checkKo();
  },

  _commands: function () {
    var cmds = {};
    var solo = this.mode && this.mode.indexOf("1p") === 0;
    var self = this;
    this.players.forEach(function (pl) {
      if (pl.control === "cpu") cmds[pl.kind] = ER.AI.think(pl, pl === self.eddie ? self.richie : self.eddie, self.items);
      else cmds[pl.kind] = ER.Input.forControl(pl.control, solo);
    });
    return cmds;
  },

  _stepWorld: function (cmds) {
    cmds = cmds || {};
    this.eddie.update(cmds.eddie || null, this.items, this.level, this.richie);
    this.richie.update(cmds.richie || null, this.items, this.level, this.eddie);
    for (var i = 0; i < this.items.length; i++) this.items[i].update(this.players, this.level);
    ER.FX.update();
    this._followCam();
  },

  _updateAttract: function () {
    this.attractT += 1;
    if (this.hitstop > 0) { this.hitstop -= 1; return; }
    if (this.attractRest > 0) {
      this.attractRest -= 1;
      this._stepWorld(null);
      if (this.attractRest === 0) this._spawnAttract();
      return;
    }
    this._stepWorld(this._commands());
    if (!this.eddie.alive || !this.richie.alive) this.attractRest = 120;
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

  /* Kept under its old name so older checks still work. */
  _checkWin: function () { this._checkKo(); },

  _checkKo: function () {
    if (this.phase === "ko" || this.screen !== "play") return;
    var eDead = !this.eddie.alive;
    var rDead = !this.richie.alive;
    if (!eDead && !rDead) return;
    if (eDead && rDead) this.koWinner = "draw";
    else {
      this.koWinner = eDead ? "richie" : "eddie";
      this.wins[this.koWinner] += 1;
    }
    this.phase = "ko";
    this.phaseT = 0;
    this.hitstop = 12;
    ER.Renderer.bump(16);
    ER.Audio.ko();
  },

  _endKo: function () {
    var w = this.koWinner;
    if (w !== "draw" && this.wins[w] >= ER.ROUNDS_TO_WIN) {
      this._endMatch(w);
      return;
    }
    if (w === "draw" && this.round >= 5) {
      this._endMatch("draw");
      return;
    }
    this.round += 1;
    this._startRound(false);
  },

  _endMatch: function (winner) {
    this.winner = winner;
    this.screen = "win";
    this.winT = 0;
    var title = document.getElementById("win-title");
    var blurb = document.getElementById("win-blurb");
    var score = document.getElementById("win-score");
    var lines = {
      eddie: ["EDDIE WINS", "One swing of the cricket bat too many."],
      richie: ["RICHIE WINS", "Never underestimate a well-aimed kettle."],
      draw: ["IT'S A DRAW", "They took each other out. Very them."]
    }[winner];
    if (title) title.textContent = lines[0];
    if (blurb) blurb.textContent = lines[1];
    if (score) score.textContent = "Rounds  " + this.wins.eddie + " – " + this.wins.richie;
    var panel = document.getElementById("win-screen");
    if (panel) panel.setAttribute("data-winner", winner);
    var st = this.stats || this._freshStats();
    var fill = function (who) {
      var s = st[who];
      var el = document.getElementById("stats-" + who);
      if (el) el.innerHTML = "<b>" + s.hits + "</b> hits &middot; <b>" + s.damage + "</b> damage &middot; best <b>" + s.biggest + "</b>";
    };
    fill("eddie");
    fill("richie");
    this._show("win-screen", true);
    ER.Audio.win();
  },

  snapshot: function () {
    return {
      screen: this.screen,
      phase: this.phase,
      mode: this.mode,
      round: this.round,
      wins: { eddie: this.wins.eddie, richie: this.wins.richie },
      camX: this.camX,
      eddie: { hp: this.eddie.hp, maxHp: this.eddie.maxHp, x: this.eddie.x, y: this.eddie.y, alive: this.eddie.alive, control: this.eddie.control },
      richie: { hp: this.richie.hp, maxHp: this.richie.maxHp, x: this.richie.x, y: this.richie.y, alive: this.richie.alive, control: this.richie.control },
      items: this.items.map(function (it) { return { type: it.type, x: it.x, y: it.y, state: it.state }; }),
      winner: this.winner
    };
  }
};

ER.Test = {
  /* Tests start straight into the fight (no ROUND 1 / FIGHT! intro). */
  start: function (mode, withIntro) { ER.Game.start(mode, { skipIntro: !withIntro }); },
  gotoTitle: function () { ER.Game.gotoTitle(); },
  state: function () { return ER.Game.snapshot(); },
  damage: function (who, n) {
    var pl = ER.Game[who];
    if (!pl) return false;
    var other = who === "eddie" ? ER.Game.richie : ER.Game.eddie;
    var ok = pl.takeDamage(n, other.x);
    if (ok) ER.Game.onHit(pl, n, other.x);
    ER.Game._checkKo();
    return ok;
  },
  /* Knock someone out and finish the whole match at once. */
  kill: function (who) {
    var G = ER.Game;
    var pl = G[who];
    if (!pl) return;
    var other = who === "eddie" ? "richie" : "eddie";
    G.wins[other] = ER.ROUNDS_TO_WIN - 1;
    pl.iframes = 0;
    pl.takeDamage(999, pl.x - 10);
    G._checkKo();
    G.hitstop = 0;
    G._endKo();
  },
  /* Knock someone out and let the round end play out normally. */
  koRound: function (who) {
    var pl = ER.Game[who];
    if (!pl) return;
    pl.iframes = 0;
    pl.takeDamage(999, pl.x - 10);
    ER.Game._checkKo();
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
