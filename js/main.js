/* Boot the page, keep the picture inside the screen, run the loop. */
window.ER = window.ER || {};

ER.fitStage = function () {
  var app = document.getElementById("app");
  var stage = document.getElementById("stage");
  var touch = document.getElementById("touch");
  if (!app || !stage) return;
  var pad = 0;
  var touchH = (touch && !touch.hidden) ? touch.getBoundingClientRect().height : 0;
  var availW = app.clientWidth;
  var availH = app.clientHeight - touchH - pad;
  if (availW < 16 || availH < 16) return;
  var scale = Math.min(availW / ER.VIEW_W, availH / ER.VIEW_H);
  var intScale = Math.floor(scale);
  if (intScale >= 1 && intScale / scale >= 0.92) scale = intScale;
  scale = Math.max(0.45, scale);
  var w = Math.floor(ER.VIEW_W * scale);
  var h = Math.floor(ER.VIEW_H * scale);
  /* Never let the stage be wider than the app. */
  if (w > availW) {
    scale = availW / ER.VIEW_W;
    w = Math.floor(ER.VIEW_W * scale);
    h = Math.floor(ER.VIEW_H * scale);
  }
  stage.style.width = w + "px";
  stage.style.height = h + "px";
};

ER.boot = function () {
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  ER.Renderer.resizeCanvas(canvas);
  ER.Input.init();
  ER.Game.init();
  ER.UI.init();
  ER.fitStage();
  window.addEventListener("resize", ER.fitStage);
  window.addEventListener("orientationchange", function () { setTimeout(ER.fitStage, 80); });

  ER.Sprites.load(function () {
    document.getElementById("app").classList.add("ready");
    ER.Renderer.resetHud(ER.Game);
    /* Fixed 60 updates a second whatever the screen's refresh rate,
       so the game never runs at half speed on a jittery 60 Hz display
       or double speed on a 120 Hz one. */
    var STEP = 1000 / 60;
    var last = performance.now();
    var acc = 0;
    function loop(now) {
      acc += Math.min(250, now - last);
      last = now;
      var steps = 0;
      while (acc >= STEP && steps < 5) {
        ER.Game.update();
        acc -= STEP;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      if (steps > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, ER.VIEW_W, ER.VIEW_H);
        ER.Renderer.draw(ctx, ER.Game);
        ER.UI.draw(ER.Game);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
};

document.addEventListener("DOMContentLoaded", ER.boot);
