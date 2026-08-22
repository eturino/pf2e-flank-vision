import { COLORS, clearOverlay, destroyOverlay, dot, line, outline } from "./draw.ts";
import { flankedBy, flankedEnemies, flankedTokens, type Options } from "./flanking.ts";
import { centerOf, type Square } from "./geometry.ts";
import { flankingPlacements } from "./placement.ts";
import {
  boundsAt,
  centerAt,
  focusToken,
  gridSize,
  previewTokens,
  visibleTokens,
  type Token,
} from "./scene.ts";

const ID = "pf2e-flank-vision";

type SettingKey =
  | "enabled"
  | "flankedMarkers"
  | "selectedStatus"
  | "dragPreview"
  | "placementDots"
  | "wallsBlock"
  | "searchRadius"
  | "maxSquares";

function setting<T>(key: SettingKey): T {
  return game.settings.get(ID, key) as T;
}

function registerSettings(): void {
  const toggles: [SettingKey, boolean][] = [
    ["enabled", true],
    ["flankedMarkers", true],
    ["selectedStatus", true],
    ["dragPreview", true],
    ["placementDots", false],
    ["wallsBlock", false],
  ];
  for (const [key, initial] of toggles) {
    game.settings.register(ID, key, {
      name: `${ID}.settings.${key}.name`,
      hint: `${ID}.settings.${key}.hint`,
      scope: "client",
      config: true,
      type: Boolean,
      default: initial,
      onChange: () => requestRender(),
    });
  }
  const numbers: [SettingKey, number][] = [
    ["searchRadius", 12],
    ["maxSquares", 400],
  ];
  for (const [key, initial] of numbers) {
    game.settings.register(ID, key, {
      name: `${ID}.settings.${key}.name`,
      hint: `${ID}.settings.${key}.hint`,
      scope: "client",
      config: true,
      type: Number,
      default: initial,
      onChange: () => requestRender(),
    });
  }

  game.keybindings.register(ID, "toggle", {
    name: `${ID}.keybindings.toggle.name`,
    editable: [{ key: "KeyF", modifiers: ["Alt"] }],
    onDown: () => {
      game.settings.set(ID, "enabled", !setting<boolean>("enabled"));
      return true;
    },
  });
}

let pending = false;

/**
 * Coalesce the bursts of hooks a single drag or update produces into one draw.
 * ponytail: the draw itself is O(tokens^2) with no caching - cache per-token squares if a
 * scene ever gets crowded enough to drop frames while dragging.
 */
function requestRender(): void {
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

function render(): void {
  clearOverlay();
  if (!setting<boolean>("enabled") || !canvas?.ready || !canvas.scene) return;

  const opts: Options = { wallsBlock: setting<boolean>("wallsBlock") };
  // ponytail: only the first dragged token gets a preview; multi-token drags fall back to its view
  const preview = setting<boolean>("dragPreview") ? (previewTokens()[0] ?? null) : null;
  const all = visibleTokens();
  const source: Token | null = preview
    ? (preview._original ?? all.find((t: Token) => t.id === preview.id) ?? null)
    : null;
  // the drag clone sits at the prospective position, so it stands in for its source token
  const tokens = all.filter((t: Token) => t !== source);
  if (preview) tokens.push(preview);

  const focus = preview ?? focusToken();

  if (setting<boolean>("flankedMarkers")) {
    for (const [token] of flankedTokens(tokens, opts)) {
      outline(boundsAt(token), COLORS.otherFlanked, 0.45);
    }
  }

  if (!focus) return;

  if (setting<boolean>("placementDots") && !preview) {
    drawPlacements(focus, tokens, opts);
  }

  if (setting<boolean>("selectedStatus") || preview) {
    drawFocusStatus(focus, tokens, opts);
  }
}

function drawFocusStatus(focus: Token, tokens: Token[], opts: Options): void {
  for (const [enemy, buddies] of flankedEnemies(focus, tokens, opts)) {
    outline(boundsAt(enemy), COLORS.flanking);
    for (const buddy of buddies) {
      line(centerAt(focus), centerAt(buddy), COLORS.flanking);
    }
  }

  const pairs = flankedBy(focus, tokens, opts);
  if (pairs.length === 0) return;
  outline(boundsAt(focus), COLORS.flanked);
  for (const pair of pairs) {
    line(centerAt(pair.a), centerAt(pair.b), COLORS.flanked, 0.45);
  }
}

function drawPlacements(focus: Token, tokens: Token[], opts: Options): void {
  const squares = flankingPlacements(focus, tokens, opts, {
    searchRadius: setting<number>("searchRadius"),
    maxSquares: setting<number>("maxSquares"),
  });
  const size = gridSize();
  const radius = Math.max(3, size / 12);
  for (const square of squares) {
    dot(centerOf([square as Square], size), COLORS.placement, radius);
  }
}

Hooks.once("init", registerSettings);

for (const hook of [
  "canvasReady",
  "canvasTearDown",
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
  "updateCombat",
]) {
  Hooks.on(hook, () => requestRender());
}

Hooks.on("canvasTearDown", () => destroyOverlay());
