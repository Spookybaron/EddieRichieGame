/* Load packed sprite sheets from the embedded PNG data. */
window.ER = window.ER || {};

ER.Sprites = {
  images: {},
  ready: false,

  load: function (done) {
    var data = ER.SPRITE_DATA;
    var keys = ["eddie", "richie", "objects", "flat"];
    var left = keys.length;
    var self = this;
    if (ER.FONT_DATA_URI) {
      var style = document.createElement("style");
      style.textContent = "@font-face{font-family:'Press Start 2P';src:url('" + ER.FONT_DATA_URI + "') format('woff2');font-display:swap;}";
      document.head.appendChild(style);
    }
    keys.forEach(function (k) {
      var img = new Image();
      img.onload = img.onerror = function () {
        left -= 1;
        if (left <= 0) {
          self.ready = true;
          if (done) done();
        }
      };
      img.src = data[k].data;
      self.images[k] = img;
    });
  },

  frame: function (sheet, name) {
    return ER.SPRITE_DATA[sheet].frames[name];
  },

  /* Draw a frame with its feet (or item base) at (x, y) in world pixels. */
  draw: function (ctx, sheet, name, x, y, flip, scale) {
    var f = this.frame(sheet, name);
    var img = this.images[sheet];
    if (!f || !img) return;
    var sc = scale == null ? 1 : scale;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img, f.x, f.y, f.w, f.h,
      Math.round(-f.ax * sc), Math.round(-f.ay * sc),
      Math.round(f.w * sc), Math.round(f.h * sc)
    );
    ctx.restore();
  }
};
