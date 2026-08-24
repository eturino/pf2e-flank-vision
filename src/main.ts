import { colors, registerColors } from "./colors.ts";
import { clearOverlay, destroyOverlay, dot, line, outline } from "./draw.ts";
import { flankedBy, flankedEnemies, flankedTokens, type FlankPair, type Options } from "./flanking.ts";
import { centerOf } from "./geometry.ts";
import type { FlankToken } from "./pf2e.ts";
import { flankingPlacements } from "./placement.ts";
import {
  boundsAt,
  centerAt,
  focusToken,
  gridSize,
  isSupportedGrid,
  previewTokens,
  squaresAt,
  visibleTokens,
} from "./scene.ts";

const ID = "pf2e-flank-vision";

// bump on every change while the drop bug is being chased, so a reload proves what is loaded.
// delete this and the debug tracing once it is settled.
const BUILD = 2;
console.log(`${ID} | build ${BUILD}`);

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
      onChange: () => requestRender("setting"),
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
      onChange: () => requestRender("setting"),
    });
  }

}

function debug(step: string, detail: Record<string, unknown>): void {
  if (CONFIG.pf2eFlankVision.debug) console.log(`${ID} | ${step}`, detail);
}

let pending = false;
let rerun = false;

/**
 * Coalesce the bursts of hooks a single drag or update produces into one draw. A request that
 * arrives while one is in flight buys one more frame rather than being dropped: a drop fires
 * `updateToken` while the drag clone is still alive, so the render it arms sees the token on the
 * square it came from, and whatever fires after the clone dies is the one that gets it right.
 *
 * ponytail: the draw itself is O(tokens^2) with no caching - cache per-token squares if a
 * scene ever gets crowded enough to drop frames while dragging.
 */
function requestRender(source: string): void {
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

let warnedAboutGrid = false;

function render(): void {
  clearOverlay();
  if (!toggled("enabled") || !canvas.ready || !canvas.scene) return;

  if (!isSupportedGrid()) {
    if (!warnedAboutGrid) {
      warnedAboutGrid = true;
      ui.notifications.warn(game.i18n.localize(`${ID}.notifications.unsupportedGrid`));
    }
    return;
  }

  const opts: Options = { wallsBlock: toggled("wallsBlock") };
  // ponytail: only the first dragged token gets a preview; multi-token drags fall back to its view
  const preview = toggled("dragPreview") ? (previewTokens()[0] ?? null) : null;
  const all = visibleTokens();
  const source = preview ? (preview._original ?? all.find((t) => t.id === preview.id) ?? null) : null;
  // the drag clone sits at the prospective position, so it stands in for its source token
  const tokens = all.filter((token) => token !== source);
  if (preview) tokens.push(preview);

  const focus = preview ?? focusToken();
  const move = focus?.document.movement;
  debug("render", {
    preview: preview?.name ?? null,
    focus: focus?.name ?? null,
    at: focus ? JSON.stringify(squaresAt(focus)) : null,
    doc: focus ? `${focus.document.x},${focus.document.y}` : null,
    move: move ? `${move.state} -> ${move.destination?.x},${move.destination?.y}` : String(move),
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

function drawFocusStatus(focus: FlankToken, tokens: FlankToken[], opts: Options, pairs: FlankPair[]): void {
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

Hooks.on("canvasReady", () => {
  warnedAboutGrid = false;
  requestRender("canvasReady");
});

let hadPreview = false;

/**
 * refreshToken fires per animation frame per token, so it is only worth listening to while a
 * drag preview exists - that is the one thing no other hook reports early enough.
 *
 * The frame the clone disappears is worth one more. `updateToken` and `moveToken` both fire while
 * it is still live, so the last render of a drop would otherwise draw the token on the square it
 * came from, and nothing afterwards would correct it.
 */
Hooks.on("refreshToken", () => {
  const live = !!canvas.tokens.preview?.children.length;
  debug("refreshToken", { live, hadPreview });
  if (live || hadPreview) requestRender("refreshToken");
  hadPreview = live;
});

// PF2e builds ActiveEffects ephemerally from items, so the item hooks cover effects too
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
  "deleteWall",
]) {
  Hooks.on(hook, () => requestRender(hook));
}

Hooks.on("canvasTearDown", () => destroyOverlay());
