/* Level registry. Later rounds register extra series locations here
   (and can attach a mini-game). Round one only has the flat. */
window.ER = window.ER || {};
ER.LEVELS = ER.LEVELS || {};

ER.registerLevel = function (level) {
  ER.LEVELS[level.id] = level;
};

ER.getLevel = function (id) {
  return ER.LEVELS[id] || ER.LEVELS.flat;
};
