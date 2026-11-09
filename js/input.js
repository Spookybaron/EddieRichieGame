/* Keyboard and on-screen touch controls. */
window.ER = window.ER || {};

ER.Input = {
  keys: {},
  p1: { x: 0, y: 0, attack: false, pickup: false },
  p2: { x: 0, y: 0, attack: false, pickup: false },
  /* In a 1-player game the human can use either set of keys. */
  solo: { x: 0, y: 0, attack: false, pickup: false },
  pausePressed: false,
  mutePressed: false,
  confirmPressed: false,
  _attackLatch1: false,
  _attackLatch2: false,
  _pickLatch1: false,
  _pickLatch2: false,
  _pauseLatch: false,
  _muteLatch: false,
  _confirmLatch: false,
  touch: { up: false, down: false, left: false, right: false, attack: false, pickup: false },

  init: function () {
    var self = this;
    window.addEventListener("keydown", function (e) {
      self.keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
      ER.Audio.unlock();
    }, { passive: false });
    window.addEventListener("keyup", function (e) {
      self.keys[e.code] = false;
    });
    this._bindTouch();
  },

  _bindTouch: function () {
    var self = this;
    var root = document.getElementById("touch");
    if (!root) return;
    function set(name, val) { self.touch[name] = val; }
    root.querySelectorAll("[data-touch]").forEach(function (el) {
      var name = el.getAttribute("data-touch");
      var on = function (e) { e.preventDefault(); set(name, true); ER.Audio.unlock(); };
      var off = function (e) { e.preventDefault(); set(name, false); };
      el.addEventListener("touchstart", on, { passive: false });
      el.addEventListener("touchend", off, { passive: false });
      el.addEventListener("touchcancel", off, { passive: false });
      el.addEventListener("mousedown", on);
      el.addEventListener("mouseup", off);
      el.addEventListener("mouseleave", off);
    });
  },

  _down: function (code) { return !!this.keys[code]; },

  _edge: function (held, latchName) {
    if (held && !this[latchName]) { this[latchName] = true; return true; }
    if (!held) this[latchName] = false;
    return false;
  },

  poll: function () {
    var t = this.touch;
    var p1Left = this._down("KeyA") || t.left;
    var p1Right = this._down("KeyD") || t.right;
    var p1Up = this._down("KeyW") || t.up;
    var p1Down = this._down("KeyS") || t.down;
    this.p1.x = (p1Right ? 1 : 0) - (p1Left ? 1 : 0);
    this.p1.y = (p1Down ? 1 : 0) - (p1Up ? 1 : 0);
    this.p1.attack = this._edge(this._down("KeyF") || t.attack, "_attackLatch1");
    this.p1.pickup = this._edge(this._down("KeyG") || t.pickup, "_pickLatch1");

    var p2Left = this._down("ArrowLeft");
    var p2Right = this._down("ArrowRight");
    var p2Up = this._down("ArrowUp");
    var p2Down = this._down("ArrowDown");
    this.p2.x = (p2Right ? 1 : 0) - (p2Left ? 1 : 0);
    this.p2.y = (p2Down ? 1 : 0) - (p2Up ? 1 : 0);
    this.p2.attack = this._edge(this._down("KeyK"), "_attackLatch2");
    this.p2.pickup = this._edge(this._down("KeyL"), "_pickLatch2");

    this.solo.x = this.p1.x || this.p2.x;
    this.solo.y = this.p1.y || this.p2.y;
    this.solo.attack = this.p1.attack || this.p2.attack;
    this.solo.pickup = this.p1.pickup || this.p2.pickup;

    this.pausePressed = this._edge(this._down("KeyP") || this._down("Escape"), "_pauseLatch");
    this.mutePressed = this._edge(this._down("KeyM"), "_muteLatch");
    this.confirmPressed = this._edge(this._down("Space") || this._down("Enter"), "_confirmLatch");
  },

  /* Snapshot for a human player. CPU ignores this and writes its own. */
  forControl: function (control, solo) {
    if (solo && control === "p1") return this.solo;
    if (control === "p1") return this.p1;
    if (control === "p2") return this.p2;
    return { x: 0, y: 0, attack: false, pickup: false };
  }
};
