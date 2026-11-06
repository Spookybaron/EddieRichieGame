/* The Hammersmith flat: living room, dining room through an arch, kitchen. */
window.ER = window.ER || {};

ER.registerLevel({
  id: "flat",
  name: "The Flat",
  worldW: 960,
  worldH: 224,
  floorTop: 176,
  floorBottom: 214,
  rooms: [
    { id: "living", name: "Living room", x0: 0, x1: 388 },
    { id: "dining", name: "Dining room", x0: 388, x1: 708 },
    { id: "kitchen", name: "Kitchen", x0: 708, x1: 960 }
  ],
  start: {
    eddie:  { x: 236, y: 202, facing:  1 },
    richie: { x: 498, y: 204, facing: -1 }
  },
  /* Objects live in the rooms that match them. */
  itemSpawns: [
    { type: "pillow",  x: 222, y: 190 },
    { type: "remote",  x: 318, y: 204 },
    { type: "ball",    x: 150, y: 206 },
    { type: "bottle",  x: 568, y: 176 },
    { type: "chair",   x: 490, y: 204 },
    { type: "kettle",  x: 812, y: 204 },
    { type: "pan",     x: 874, y: 204 },
    { type: "toaster", x: 756, y: 204 }
  ],
  roomAt: function (x) {
    var rooms = this.rooms;
    for (var i = 0; i < rooms.length; i++) {
      if (x >= rooms[i].x0 && x < rooms[i].x1) return rooms[i];
    }
    return rooms[rooms.length - 1];
  }
});
