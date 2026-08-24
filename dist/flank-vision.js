// src/colors.ts
var DEFAULT_COLORS = {
  flanking: 3390542,
  otherFlanked: 15849526,
  flanked: 15147300,
  placement: 4448223
};
function registerColors() {
  CONFIG.pf2eFlankVision = { colors: { ...DEFAULT_COLORS }, debug: false };
}
function colors() {
  return CONFIG.pf2eFlankVision.colors;
}

// src/draw.ts
var layer = null;
function overlay() {
  if (!layer || layer.destroyed) {
    layer = new PIXI.Graphics();
    layer.eventMode = "none";
    canvas.tokens.addChild(layer);
  }
  return layer;
}
function clearOverlay() {
  if (layer && !layer.destroyed) layer.clear();
}
function destroyOverlay() {
  if (layer && !layer.destroyed) layer.destroy();
  layer = null;
}
function thickness() {
  return CONFIG.Canvas.objectBorderThickness;
}
function outline(bounds, color, alpha = 0.8) {
  const { left, top, right, bottom } = bounds;
  overlay().lineStyle(thickness() * 1.5, 0, alpha * 0.5).drawRect(left, top, right - left, bottom - top).lineStyle(thickness(), color, alpha).drawRect(left, top, right - left, bottom - top);
}
function line(a, b, color, alpha = 0.6) {
  overlay().lineStyle(thickness() * 1.5, 0, alpha * 0.5).moveTo(a.x, a.y).lineTo(b.x, b.y).lineStyle(thickness(), color, alpha).moveTo(a.x, a.y).lineTo(b.x, b.y);
}
function dot(point, color, radius, alpha = 0.7) {
  overlay().lineStyle(1, 0, alpha).beginFill(color, alpha).drawCircle(point.x, point.y, radius).endFill();
}

// src/distance.ts
function extent(squares, axis) {
  const values = squares.map((square) => square[axis]);
  return { min: Math.min(...values), max: Math.max(...values) };
}
function spansOverlap(a, b) {
  return a.min <= b.max && b.min <= a.max;
}
function axisSteps(a, b) {
  return Math.max(a.min - b.max - 1, b.min - a.max - 1, 0) + 1;
}
function elevationSteps(a, b, gridDistance2) {
  const spanA = { min: a.elevation, max: a.elevation + a.height };
  const spanB = { min: b.elevation, max: b.elevation + b.height };
  if (spanA.min < spanB.max && spanB.min < spanA.max) return 0;
  const gap = Math.max(spanA.min - spanB.max, spanB.min - spanA.max, 0);
  return Math.ceil(gap / gridDistance2) + 1;
}
function measureDistanceFeet(a, b, { gridDistance: gridDistance2, reach }) {
  const [ax, ay] = [extent(a.squares, "x"), extent(a.squares, "y")];
  const [bx, by] = [extent(b.squares, "x"), extent(b.squares, "y")];
  const sharesFootprint = spansOverlap(ax, bx) && spansOverlap(ay, by);
  const elevation = elevationSteps(a, b, gridDistance2);
  const steps = [
    sharesFootprint ? 0 : axisSteps(ax, bx),
    sharesFootprint ? 0 : axisSteps(ay, by),
    elevation
  ].sort((left, right) => left - right);
  const doubleDiagonal = steps[0] ?? 0;
  const diagonal = (steps[1] ?? 0) - doubleDiagonal;
  const straight = (steps[2] ?? 0) - (steps[1] ?? 0);
  const reduction = elevation === 0 && diagonal > 1 && reach === 10 ? 1 : 0;
  const squares = Math.floor(doubleDiagonal * 1.75 + diagonal * 1.5 + straight) - reduction;
  return squares * gridDistance2;
}
function withinReach(a, b, reach, gridDistance2) {
  return measureDistanceFeet(a, b, { gridDistance: gridDistance2, reach }) <= reach;
}

// src/geometry.ts
function topLeft(squares) {
  return squares.reduce(
    (acc, s) => ({ x: Math.min(acc.x, s.x), y: Math.min(acc.y, s.y) }),
    { x: Infinity, y: Infinity }
  );
}
function shiftSquares(squares, to) {
  const ref = topLeft(squares);
  const dx = to.x - ref.x;
  const dy = to.y - ref.y;
  return squares.map((s) => ({ x: s.x + dx, y: s.y + dy }));
}
function squareGap(a, b) {
  let min = Infinity;
  for (const sa of a) {
    for (const sb of b) {
      const d = Math.max(Math.abs(sa.x - sb.x), Math.abs(sa.y - sb.y));
      if (d < min) min = d;
    }
  }
  return min;
}
function overlaps(a, b) {
  return squareGap(a, b) === 0;
}
function boundsOf(squares, gridSize2) {
  const xs = squares.map((s) => s.x);
  const ys = squares.map((s) => s.y);
  return {
    left: Math.min(...xs) * gridSize2,
    top: Math.min(...ys) * gridSize2,
    right: (Math.max(...xs) + 1) * gridSize2,
    bottom: (Math.max(...ys) + 1) * gridSize2
  };
}
function centerOf(squares, gridSize2) {
  const b = boundsOf(squares, gridSize2);
  return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
}
function orientation(p, q, r) {
  const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (v === 0) return 0;
  return v > 0 ? 1 : -1;
}
function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 !== o2 && o3 !== o4;
}
function onOppositeSides(centerA, centerB, bounds) {
  const { left, right, top, bottom } = bounds;
  const crosses = (p, q) => segmentsIntersect(centerA, centerB, p, q);
  const hitsLeft = crosses({ x: left, y: top }, { x: left, y: bottom });
  const hitsRight = crosses({ x: right, y: top }, { x: right, y: bottom });
  const hitsTop = crosses({ x: left, y: top }, { x: right, y: top });
  const hitsBottom = crosses({ x: left, y: bottom }, { x: right, y: bottom });
  return hitsLeft && hitsRight || hitsTop && hitsBottom;
}
function surroundingSquares(squares, radius) {
  const xs = squares.map((s) => s.x);
  const ys = squares.map((s) => s.y);
  const minX = Math.min(...xs) - radius;
  const maxX = Math.max(...xs) + radius;
  const minY = Math.min(...ys) - radius;
  const maxY = Math.max(...ys) + radius;
  const out = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!squares.some((s) => s.x === x && s.y === y)) out.push({ x, y });
    }
  }
  return out;
}

// src/pf2e.ts
function isFlankToken(token) {
  if (typeof token !== "object" || token === null) return false;
  if (!("actor" in token) || !("document" in token)) return false;
  const actor = token.actor;
  if (typeof actor !== "object" || actor === null) return false;
  if (!("attributes" in actor) || !("getReach" in actor) || !("isAllyOf" in actor)) return false;
  if (typeof actor.getReach !== "function" || typeof actor.isAllyOf !== "function") return false;
  const attributes = actor.attributes;
  return typeof attributes === "object" && attributes !== null && "flanking" in attributes;
}

// src/scene.ts
function gridSize() {
  return canvas.grid.size;
}
function gridDistance() {
  return canvas.dimensions.distance;
}
function settledPosition(token) {
  const doc = token.document;
  const to = doc.movement?.state === "pending" ? doc.movement.destination : null;
  return {
    x: to?.x ?? doc.x,
    y: to?.y ?? doc.y,
    elevation: to?.elevation ?? doc.elevation,
    width: to?.width ?? doc.width,
    height: to?.height ?? doc.height
  };
}
function occupiedSquares(token) {
  const size = gridSize();
  const at = settledPosition(token);
  const originX = Math.floor(at.x / size);
  const originY = Math.floor(at.y / size);
  const squares = [];
  for (let x = 0; x < Math.max(1, Math.round(at.width)); x++) {
    for (let y = 0; y < Math.max(1, Math.round(at.height)); y++) {
      squares.push({ x: originX + x, y: originY + y });
    }
  }
  return squares;
}
function squaresAt(token, at) {
  const squares = occupiedSquares(token);
  return at ? shiftSquares(squares, at) : squares;
}
function centerAt(token, at) {
  return centerOf(squaresAt(token, at), gridSize());
}
function boundsAt(token, at) {
  return boundsOf(squaresAt(token, at), gridSize());
}
function reachInFeet(token) {
  return token.actor.getReach({ action: "attack" });
}
function footprintAt(token, at) {
  return {
    squares: squaresAt(token, at),
    elevation: settledPosition(token).elevation,
    height: token.actor.dimensions?.height ?? gridDistance()
  };
}
function visibleTokens() {
  return canvas.tokens.placeables.filter(isFlankToken).filter((token) => !token.isPreview && !token.document.hidden && (game.user.isGM || token.visible));
}
function isSupportedGrid() {
  return canvas.grid.type === CONST.GRID_TYPES.SQUARE;
}
function canOccupy(token, at, others) {
  const squares = shiftSquares(occupiedSquares(token), at);
  const size = gridSize();
  const scene = canvas.dimensions.sceneRect;
  for (const s of squares) {
    const x = s.x * size;
    const y = s.y * size;
    if (x < scene.x || y < scene.y || x + size > scene.x + scene.width || y + size > scene.y + scene.height) {
      return false;
    }
  }
  return !others.some((other) => other !== token && overlaps(squares, occupiedSquares(other)));
}
function wallBetween(a, b) {
  return CONFIG.Canvas.polygonBackends.move.testCollision(a, b, { type: "move", mode: "any" });
}
function focusToken() {
  const controlled = canvas.tokens.controlled.filter(isFlankToken);
  const first = controlled.at(0);
  if (first) return first;
  const character = game.user.character;
  if (!character) return null;
  return visibleTokens().find((token) => token.actor.id === character.id) ?? null;
}
function previewTokens() {
  return (canvas.tokens.preview?.children ?? []).filter(isFlankToken);
}

// src/flanking.ts
function canFlank(attacker, flankee, attackerAt) {
  if (attacker === flankee) return false;
  const actor = attacker.actor;
  const target = flankee.actor;
  if (!actor.attributes.flanking.canFlank) return false;
  if (!target.attributes.flanking.flankable) return false;
  if (!actor.canAttack) return false;
  if (attacker.document.hidden || flankee.document.hidden) return false;
  if (actor.isAllyOf(target)) return false;
  const reach = reachInFeet(attacker);
  return withinReach(footprintAt(attacker, attackerAt), footprintAt(flankee), reach, gridDistance());
}
function isAlly(a, b) {
  if (a === b) return false;
  return a.actor.isAllyOf(b.actor) || a.actor === b.actor;
}
function opposite(attacker, buddy, flankee, at, opts) {
  const centerA = centerAt(attacker, at);
  const centerB = centerAt(buddy);
  if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) return false;
  return !(opts.wallsBlock && wallBetween(centerA, centerB));
}
function gangsUp(attacker, buddies) {
  return attacker.actor.attributes.flanking.canGangUp.some(
    (g) => typeof g === "number" && g <= buddies.length || g === true && buddies.length >= 1
  );
}
function buddiesAmong(attacker, flankee, threats, opts, at) {
  const threatening = threats.filter((t) => t !== attacker && isAlly(attacker, t));
  if (threatening.length === 0) return [];
  if (gangsUp(attacker, threatening)) return threatening;
  return threatening.filter((buddy) => opposite(attacker, buddy, flankee, at, opts));
}
function buddiesFlanking(attacker, flankee, tokens, opts, at) {
  if (!canFlank(attacker, flankee, at)) return [];
  return buddiesAmong(attacker, flankee, threatsAgainst(flankee, tokens), opts, at);
}
function flankedEnemies(attacker, tokens, opts, at) {
  const result = /* @__PURE__ */ new Map();
  for (const enemy of tokens) {
    const buddies = buddiesFlanking(attacker, enemy, tokens, opts, at);
    if (buddies.length > 0) result.set(enemy, buddies);
  }
  return result;
}
function flankedBy(flankee, tokens, opts) {
  const threats = threatsAgainst(flankee, tokens);
  const seen = /* @__PURE__ */ new Set();
  const pairs = [];
  for (const attacker of threats) {
    for (const buddy of buddiesAmong(attacker, flankee, threats, opts)) {
      const key = [attacker.id, buddy.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: attacker, b: buddy });
    }
  }
  return pairs;
}
function flankedTokens(tokens, opts) {
  const result = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    const pairs = flankedBy(token, tokens, opts);
    if (pairs.length > 0) result.set(token, pairs);
  }
  return result;
}
function threatsAgainst(flankee, tokens) {
  return tokens.filter((t) => canFlank(t, flankee));
}

// src/placement.ts
function flankingPlacements(token, tokens, opts, limits) {
  const own = occupiedSquares(token);
  const span = Math.max(...own.map((s) => s.x)) - Math.min(...own.map((s) => s.x)) + 1;
  const reach = Math.ceil(reachInFeet(token) / gridDistance());
  const found = /* @__PURE__ */ new Map();
  const enemies = tokens.filter(
    (enemy) => !isAlly(token, enemy) && enemy !== token && enemy.actor.attributes.flanking.flankable && squareGap(own, squaresAt(enemy)) <= limits.searchRadius && // no ally threatening it means no square of ours can flank it
    tokens.some((ally) => isAlly(token, ally) && canFlank(ally, enemy))
  );
  for (const enemy of enemies) {
    for (const square of surroundingSquares(squaresAt(enemy), reach + span)) {
      if (found.size >= limits.maxSquares) return [...found.values()];
      const key = `${square.x},${square.y}`;
      if (found.has(key)) continue;
      if (!canFlank(token, enemy, square)) continue;
      if (!canOccupy(token, square, tokens)) continue;
      if (buddiesFlanking(token, enemy, tokens, opts, square).length === 0) continue;
      found.set(key, square);
    }
  }
  return [...found.values()];
}

// src/main.ts
var ID = "pf2e-flank-vision";
var BUILD = 2;
console.log(`${ID} | build ${BUILD}`);
var TOGGLES = {
  enabled: true,
  flankedMarkers: true,
  selectedStatus: true,
  dragPreview: true,
  placementDots: false,
  wallsBlock: false
};
var AMOUNTS = {
  searchRadius: 12,
  maxSquares: 400
};
function toggled(key) {
  const value = game.settings.get(ID, key);
  return typeof value === "boolean" ? value : TOGGLES[key];
}
function amount(key) {
  const value = game.settings.get(ID, key);
  return typeof value === "number" ? value : AMOUNTS[key];
}
function registerSettings() {
  for (const [key, initial] of Object.entries(TOGGLES)) {
    game.settings.register(ID, key, {
      name: `${ID}.settings.${key}.name`,
      hint: `${ID}.settings.${key}.hint`,
      scope: "client",
      config: true,
      type: Boolean,
      default: initial,
      onChange: () => requestRender("setting")
    });
  }
  for (const [key, initial] of Object.entries(AMOUNTS)) {
    game.settings.register(ID, key, {
      name: `${ID}.settings.${key}.name`,
      hint: `${ID}.settings.${key}.hint`,
      scope: "client",
      config: true,
      type: Number,
      default: initial,
      onChange: () => requestRender("setting")
    });
  }
}
function debug(step, detail) {
  if (CONFIG.pf2eFlankVision.debug) console.log(`${ID} | ${step}`, detail);
}
var pending = false;
var rerun = false;
function requestRender(source) {
  debug("request", { source, pending, rerun });
  if (pending) {
    rerun = true;
    return;
  }
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    try {
      render();
    } catch (error) {
      console.error(`${ID} | render failed`, error);
    }
    if (rerun) {
      rerun = false;
      requestRender("rerun");
    }
  });
}
var warnedAboutGrid = false;
function render() {
  clearOverlay();
  if (!toggled("enabled") || !canvas.ready || !canvas.scene) return;
  if (!isSupportedGrid()) {
    if (!warnedAboutGrid) {
      warnedAboutGrid = true;
      ui.notifications.warn(game.i18n.localize(`${ID}.notifications.unsupportedGrid`));
    }
    return;
  }
  const opts = { wallsBlock: toggled("wallsBlock") };
  const preview = toggled("dragPreview") ? previewTokens()[0] ?? null : null;
  const all = visibleTokens();
  const source = preview ? preview._original ?? all.find((t) => t.id === preview.id) ?? null : null;
  const tokens = all.filter((token) => token !== source);
  if (preview) tokens.push(preview);
  const focus = preview ?? focusToken();
  const move = focus?.document.movement;
  debug("render", {
    preview: preview?.name ?? null,
    focus: focus?.name ?? null,
    at: focus ? JSON.stringify(squaresAt(focus)) : null,
    doc: focus ? `${focus.document.x},${focus.document.y}` : null,
    move: move ? `${move.state} -> ${move.destination?.x},${move.destination?.y}` : String(move)
  });
  const marked = toggled("flankedMarkers") ? flankedTokens(tokens, opts) : null;
  if (marked) {
    for (const [token] of marked) outline(boundsAt(token), colors().otherFlanked, 0.45);
  }
  if (!focus) return;
  if (toggled("placementDots") && !preview) {
    drawPlacements(focus, tokens, opts);
  }
  if (toggled("selectedStatus") || preview) {
    drawFocusStatus(focus, tokens, opts, marked?.get(focus) ?? flankedBy(focus, tokens, opts));
  }
}
function drawFocusStatus(focus, tokens, opts, pairs) {
  for (const [enemy, buddies] of flankedEnemies(focus, tokens, opts)) {
    outline(boundsAt(enemy), colors().flanking);
    for (const buddy of buddies) {
      line(centerAt(focus), centerAt(buddy), colors().flanking);
    }
  }
  if (pairs.length === 0) return;
  outline(boundsAt(focus), colors().flanked);
  for (const pair of pairs) {
    line(centerAt(pair.a), centerAt(pair.b), colors().flanked, 0.45);
  }
}
function drawPlacements(focus, tokens, opts) {
  const squares = flankingPlacements(focus, tokens, opts, {
    searchRadius: amount("searchRadius"),
    maxSquares: amount("maxSquares")
  });
  const size = gridSize();
  const radius = Math.max(3, size / 12);
  for (const square of squares) {
    dot(centerOf([square], size), colors().placement, radius);
  }
}
Hooks.once("init", () => {
  registerColors();
  registerSettings();
});
Hooks.on("canvasReady", () => {
  warnedAboutGrid = false;
  requestRender("canvasReady");
});
var hadPreview = false;
Hooks.on("refreshToken", () => {
  const live = !!canvas.tokens.preview?.children.length;
  debug("refreshToken", { live, hadPreview });
  if (live || hadPreview) requestRender("refreshToken");
  hadPreview = live;
});
for (const hook of [
  "controlToken",
  "createToken",
  "deleteToken",
  "updateToken",
  "moveToken",
  "stopToken",
  "createItem",
  "updateItem",
  "deleteItem",
  "updateActor",
  "updateCombat",
  "createWall",
  "updateWall",
  "deleteWall"
]) {
  Hooks.on(hook, () => requestRender(hook));
}
Hooks.on("canvasTearDown", () => destroyOverlay());
