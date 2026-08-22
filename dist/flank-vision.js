// src/colors.ts
var DEFAULT_COLORS = {
  flanking: 3390542,
  otherFlanked: 15849526,
  flanked: 15147300,
  placement: 4448223
};
function registerColors() {
  CONFIG.pf2eFlankVision = { colors: { ...DEFAULT_COLORS } };
}
function colors() {
  return CONFIG.pf2eFlankVision?.colors ?? DEFAULT_COLORS;
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
function withinReach(a, b, reachSquares) {
  return squareGap(a, b) <= reachSquares;
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
  return canvas.dimensions?.distance || 5;
}
function occupiedSquares(token) {
  const offsets = token.document.getOccupiedGridSpaceOffsets();
  if (offsets.length > 0) return offsets.map((offset) => ({ x: offset.j, y: offset.i }));
  const size = gridSize();
  const originX = Math.floor(token.document.x / size);
  const originY = Math.floor(token.document.y / size);
  const squares = [];
  for (let x = 0; x < Math.max(1, Math.round(token.document.width)); x++) {
    for (let y = 0; y < Math.max(1, Math.round(token.document.height)); y++) {
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
function reachInSquares(token) {
  const feet = token.actor?.getReach({ action: "attack" }) ?? gridDistance();
  return Math.max(1, Math.round(feet / gridDistance()));
}
function visibleTokens() {
  const isGM = game.user.isGM;
  return canvas.tokens.placeables.filter(isFlankToken).filter((token) => !token.isPreview && (isGM || !token.document.hidden));
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
  const backend = CONFIG.Canvas.polygonBackends?.move;
  if (!backend) return false;
  return backend.testCollision(a, b, { type: "move", mode: "any" });
}
function focusToken() {
  const controlled = canvas.tokens.controlled.filter(isFlankToken);
  const first = controlled.at(0);
  if (first) return first;
  const character = game.user.character;
  if (!character) return null;
  return visibleTokens().find((token) => token.actor?.id === character.id) ?? null;
}
function previewTokens() {
  return (canvas.tokens.preview?.children ?? []).filter(isFlankToken);
}

// src/flanking.ts
function canFlank(attacker, flankee, attackerAt) {
  if (attacker === flankee) return false;
  const actor = attacker.actor;
  const target = flankee.actor;
  if (!actor || !target) return false;
  if (!actor.attributes?.flanking?.canFlank) return false;
  if (!target.attributes?.flanking?.flankable) return false;
  if (actor.canAttack === false) return false;
  if (actor.isAllyOf?.(target)) return false;
  return withinReach(squaresAt(attacker, attackerAt), squaresAt(flankee), reachInSquares(attacker));
}
function isAlly(a, b) {
  if (!a.actor || !b.actor) return false;
  if (a === b) return false;
  return !!a.actor.isAllyOf?.(b.actor) || a.actor === b.actor;
}
function opposite(attacker, buddy, flankee, at, opts) {
  const centerA = centerAt(attacker, at);
  const centerB = centerAt(buddy);
  if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) return false;
  return !(opts.wallsBlock && wallBetween(centerA, centerB));
}
function gangsUp(attacker, buddies) {
  const canGangUp = attacker.actor?.attributes?.flanking?.canGangUp ?? [];
  return canGangUp.some(
    (g) => typeof g === "number" && g <= buddies.length || g === true && buddies.length >= 1
  );
}
function buddiesFlanking(attacker, flankee, tokens, opts, at) {
  if (!canFlank(attacker, flankee, at)) return [];
  const threatening = tokens.filter(
    (t) => t !== attacker && isAlly(attacker, t) && canFlank(t, flankee)
  );
  if (threatening.length === 0) return [];
  if (gangsUp(attacker, threatening)) return threatening;
  return threatening.filter((buddy) => opposite(attacker, buddy, flankee, at, opts));
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
  const seen = /* @__PURE__ */ new Set();
  const pairs = [];
  for (const attacker of tokens) {
    for (const buddy of buddiesFlanking(attacker, flankee, tokens, opts)) {
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

// src/placement.ts
function flankingPlacements(token, tokens, opts, limits) {
  const own = occupiedSquares(token);
  const span = Math.max(...own.map((s) => s.x)) - Math.min(...own.map((s) => s.x)) + 1;
  const reach = reachInSquares(token);
  const found = /* @__PURE__ */ new Map();
  const enemies = tokens.filter(
    (enemy) => !isAlly(token, enemy) && enemy !== token && enemy.actor?.attributes?.flanking?.flankable && squareGap(own, squaresAt(enemy)) <= limits.searchRadius && // no ally threatening it means no square of ours can flank it
    tokens.some((ally) => isAlly(token, ally) && canFlank(ally, enemy))
  );
  for (const enemy of enemies) {
    for (const square of surroundingSquares(squaresAt(enemy), reach + span)) {
      const key = `${square.x},${square.y}`;
      if (found.has(key)) continue;
      if (!canFlank(token, enemy, square)) continue;
      if (!canOccupy(token, square, tokens)) continue;
      if (buddiesFlanking(token, enemy, tokens, opts, square).length === 0) continue;
      found.set(key, square);
      if (found.size >= limits.maxSquares) return [...found.values()];
    }
  }
  return [...found.values()];
}

// src/main.ts
var ID = "pf2e-flank-vision";
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
      onChange: () => requestRender()
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
      onChange: () => requestRender()
    });
  }
  game.keybindings.register(ID, "toggle", {
    name: `${ID}.keybindings.toggle.name`,
    editable: [{ key: "KeyF", modifiers: ["Alt"] }],
    onDown: () => {
      game.settings.set(ID, "enabled", !toggled("enabled"));
      return true;
    }
  });
}
var pending = false;
function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    try {
      render();
    } catch (error) {
      console.error(`${ID} | render failed`, error);
    }
  });
}
function render() {
  clearOverlay();
  if (!toggled("enabled") || !canvas.ready || !canvas.scene) return;
  const opts = { wallsBlock: toggled("wallsBlock") };
  const preview = toggled("dragPreview") ? previewTokens()[0] ?? null : null;
  const all = visibleTokens();
  const source = preview ? preview._original ?? all.find((t) => t.id === preview.id) ?? null : null;
  const tokens = all.filter((token) => token !== source);
  if (preview) tokens.push(preview);
  const focus = preview ?? focusToken();
  if (toggled("flankedMarkers")) {
    for (const [token] of flankedTokens(tokens, opts)) {
      outline(boundsAt(token), colors().otherFlanked, 0.45);
    }
  }
  if (!focus) return;
  if (toggled("placementDots") && !preview) {
    drawPlacements(focus, tokens, opts);
  }
  if (toggled("selectedStatus") || preview) {
    drawFocusStatus(focus, tokens, opts);
  }
}
function drawFocusStatus(focus, tokens, opts) {
  for (const [enemy, buddies] of flankedEnemies(focus, tokens, opts)) {
    outline(boundsAt(enemy), colors().flanking);
    for (const buddy of buddies) {
      line(centerAt(focus), centerAt(buddy), colors().flanking);
    }
  }
  const pairs = flankedBy(focus, tokens, opts);
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
for (const hook of [
  "canvasReady",
  "controlToken",
  "createToken",
  "deleteToken",
  "updateToken",
  "moveToken",
  "stopToken",
  "refreshToken",
  "updateActor",
  "createItem",
  "updateItem",
  "deleteItem",
  "createActiveEffect",
  "deleteActiveEffect",
  "updateCombat"
]) {
  Hooks.on(hook, () => requestRender());
}
Hooks.on("canvasTearDown", () => destroyOverlay());
