/* Load packed sprite sheets from the embedded PNG data. */
window.ER = window.ER || {};

ER.Sprites = {
  images: {},
  tints: {},
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

  /* A solid-colour copy of a whole sheet, for hit flashes and after-images. */
  tinted: function (sheet, color) {
    var key = sheet + "|" + color;
    if (this.tints[key]) return this.tints[key];
    var img = this.images[sheet];
    if (!img || !img.naturalWidth) return null;
    var c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.tints[key] = c;
    return c;
  },

  /* Draw a frame with its feet (or item base) at (x, y) in world pixels.
     `img` can swap in a tinted copy of the same sheet. */
  draw: function (ctx, sheet, name, x, y, flip, scale, img) {
    var f = this.frame(sheet, name);
    img = img || this.images[sheet];
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
  },

  /* Draw the top of a character's idle frame (their head) into a square box. */
  portrait: function (ctx, sheet, x, y, size, flip, img) {
    var f = this.frame(sheet, "idle0");
    img = img || this.images[sheet];
    if (!f || !img) return;
    var src = Math.min(f.w, 24);
    var sx = f.x + Math.round((f.w - src) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x + (flip ? size : 0), y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, f.y, src, src, 0, 0, size, size);
    ctx.restore();
  }
};
