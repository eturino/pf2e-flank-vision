import { colors, registerColors } from "./colors.ts";
import { clearOverlay, destroyOverlay, dot, line, outline } from "./draw.ts";
import { flankedBy, flankedEnemies, flankedTokens, type Options } from "./flanking.ts";
import { centerOf } from "./geometry.ts";
import type { FlankToken } from "./pf2e.ts";
import { flankingPlacements } from "./placement.ts";
import { boundsAt, centerAt, focusToken, gridSize, previewTokens, visibleTokens } from "./scene.ts";

const ID = "pf2e-flank-vision";

type Toggle = "enabled" | "flankedMarkers" | "selectedStatus" | "dragPreview" | "placementDots" | "wallsBlock";
type Amount = "searchRadius" | "maxSquares";

const TOGGLES: Record<Toggle, boolean> = {
  enabled: true,
  flankedMarkers: true,
  selectedStatus: true,
  dragPreview: true,
  placementDots: false,
  wallsBlock: false,
};

const AMOUNTS: Record<Amount, number> = {
  searchRadius: 12,
  maxSquares: 400,
};

/** Settings come back as unknown; fall back to the registered default rather than trusting them. */
function toggled(key: Toggle): boolean {
  const value = game.settings.get(ID, key);
  return typeof value === "boolean" ? value : TOGGLES[key];
}

function amount(key: Amount): number {
  const value = game.settings.get(ID, key);
  return typeof value === "number" ? value : AMOUNTS[key];
}

function registerSettings(): void {
  for (const [key, initial] of Object.entries(TOGGLES)) {
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
  for (const [key, initial] of Object.entries(AMOUNTS)) {
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
      game.settings.set(ID, "enabled", !toggled("enabled"));
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
  if (!toggled("enabled") || !canvas.ready || !canvas.scene) return;

  const opts: Options = { wallsBlock: toggled("wallsBlock") };
  // ponytail: only the first dragged token gets a preview; multi-token drags fall back to its view
  const preview = toggled("dragPreview") ? (previewTokens()[0] ?? null) : null;
  const all = visibleTokens();
  const source = preview ? (preview._original ?? all.find((t) => t.id === preview.id) ?? null) : null;
  // the drag clone sits at the prospective position, so it stands in for its source token
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

function drawFocusStatus(focus: FlankToken, tokens: FlankToken[], opts: Options): void {
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

function drawPlacements(focus: FlankToken, tokens: FlankToken[], opts: Options): void {
  const squares = flankingPlacements(focus, tokens, opts, {
    searchRadius: amount("searchRadius"),
    maxSquares: amount("maxSquares"),
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
  "updateCombat",
]) {
  Hooks.on(hook, () => requestRender());
}

Hooks.on("canvasTearDown", () => destroyOverlay());
