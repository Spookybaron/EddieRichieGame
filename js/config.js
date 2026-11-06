/* Shared numbers for the flat fight. */
window.ER = window.ER || {};

ER.VIEW_W = 320;
ER.VIEW_H = 224;
ER.WORLD_W = 960;
ER.WORLD_H = 224;
ER.FLOOR_TOP = 176;
ER.FLOOR_BOTTOM = 214;

ER.STATS = {
  eddie:  { hp: 140, speed: 1.16, accel: 0.38, friction: 0.78, name: "EDDIE"  },
  richie: { hp:  90, speed: 1.94, accel: 0.52, friction: 0.80, name: "RICHIE" }
};

ER.ITEM_SPEC = {
  kettle:  { damage: 18, speed: 3.35, gravity: 0.13, radius: 10, scale: 0.40, vy: -2.3, heavy: false },
  pan:     { damage: 18, speed: 3.15, gravity: 0.14, radius: 11, scale: 0.36, vy: -2.2, heavy: false },
  toaster: { damage: 20, speed: 2.55, gravity: 0.17, radius: 12, scale: 0.36, vy: -1.8, heavy: true  },
  bottle:  { damage: 16, speed: 3.80, gravity: 0.12, radius:  7, scale: 0.42, vy: -2.5, heavy: false },
  ball:    { damage: 14, speed: 4.35, gravity: 0.09, radius:  9, scale: 0.40, vy: -2.1, heavy: false, bounce: 0.52 },
  remote:  { damage: 10, speed: 4.05, gravity: 0.11, radius:  7, scale: 0.36, vy: -2.0, heavy: false },
  pillow:  { damage:  8, speed: 2.35, gravity: 0.05, radius: 12, scale: 0.40, vy: -1.6, heavy: false, fluffy: true },
  chair:   { damage: 26, speed: 2.05, gravity: 0.20, radius: 14, scale: 0.52, vy: -1.5, heavy: true, obstacle: true },
  bat:     { damage: 16, speed: 3.40, gravity: 0.14, radius: 10, scale: 0.40, vy: -2.2, heavy: false }
};

ER.EDDIE_SWING = { windup: 8, active: 12, recover: 20, damage: 24, range: 34, cooldown: 8 };
ER.RICHIE_THROW = { windup: 9, recover: 14, cooldown: 6 };
