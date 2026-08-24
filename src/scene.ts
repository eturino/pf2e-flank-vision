import {
  boundsOf,
  centerOf,
  overlaps,
  shiftSquares,
  type Bounds,
  type Point,
  type Square,
} from "./geometry.ts";
import type { Footprint } from "./distance.ts";
import { isFlankToken, type FlankToken } from "./pf2e.ts";

export function gridSize(): number {
  return canvas.grid.size;
}

/** Feet (or whatever unit) covered by one grid square. */
export function gridDistance(): number {
  return canvas.dimensions.distance;
}

interface Position {
  x: number;
  y: number;
  elevation: number;
  width: number;
  height: number;
}

/**
 * Where the token ends up, not where it is this frame. Foundry animates `document.x/y` along the
 * path, so a draw scheduled by a drop reads a point partway there and lands on the square the
 * token came from. The movement carries its own destination, settled from the first frame.
 *
 * `movement` is optional here on purpose: drag clones are constructed by Foundry and the types
 * say nothing about what a clone carries.
 */
function settledPosition(token: FlankToken): Position {
  const doc = token.document;
  const to = doc.movement?.state === "pending" ? doc.movement.destination : null;
  return {
    x: to?.x ?? doc.x,
    y: to?.y ?? doc.y,
    elevation: to?.elevation ?? doc.elevation,
    width: to?.width ?? doc.width,
    height: to?.height ?? doc.height,
  };
}

export function occupiedSquares(token: FlankToken): Square[] {
  const size = gridSize();
  const at = settledPosition(token);
  const originX = Math.floor(at.x / size);
  const originY = Math.floor(at.y / size);
  const squares: Square[] = [];
  for (let x = 0; x < Math.max(1, Math.round(at.width)); x++) {
    for (let y = 0; y < Math.max(1, Math.round(at.height)); y++) {
      squares.push({ x: originX + x, y: originY + y });
    }
  }
  return squares;
}

export function squaresAt(token: FlankToken, at?: Square): Square[] {
  const squares = occupiedSquares(token);
  return at ? shiftSquares(squares, at) : squares;
}

export function centerAt(token: FlankToken, at?: Square): Point {
  return centerOf(squaresAt(token, at), gridSize());
}

export function boundsAt(token: FlankToken, at?: Square): Bounds {
  return boundsOf(squaresAt(token, at), gridSize());
}

export function reachInFeet(token: FlankToken): number {
  return token.actor.getReach({ action: "attack" });
}

/** Squares plus vertical span: PF2e measures elevation as part of the same distance. */
export function footprintAt(token: FlankToken, at?: Square): Footprint {
  return {
    squares: squaresAt(token, at),
    elevation: settledPosition(token).elevation,
    height: token.actor.dimensions?.height ?? gridDistance(),
  };
}

/**
 * Tokens this client may reason about. GM-hidden tokens are out for everyone, matching PF2e
 * (`canFlank` refuses when either token is hidden), and tokens the player cannot see are out
 * too - drawing an outline on one would leak its position.
 */
export function visibleTokens(): FlankToken[] {
  return canvas.tokens.placeables
    .filter(isFlankToken)
    .filter((token) => !token.isPreview && !token.document.hidden && (game.user.isGM || token.visible));
}

/** This module's geometry assumes square grids; hex and gridless would be drawn wrong. */
export function isSupportedGrid(): boolean {
  return canvas.grid.type === CONST.GRID_TYPES.SQUARE;
}

export function canOccupy(token: FlankToken, at: Square, others: FlankToken[]): boolean {
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

/** Wall between two points, using the same collision backend as token movement. */
export function wallBetween(a: Point, b: Point): boolean {
  return CONFIG.Canvas.polygonBackends.move.testCollision(a, b, { type: "move", mode: "any" });
}

/** The token whose situation we report on: the controlled one, else the assigned character. */
export function focusToken(): FlankToken | null {
  const controlled = canvas.tokens.controlled.filter(isFlankToken);
  const first = controlled.at(0);
  if (first) return first;
  const character = game.user.character;
  if (!character) return null;
  return visibleTokens().find((token) => token.actor.id === character.id) ?? null;
}

/** Drag clones live on the preview layer while a token is being moved. */
export function previewTokens(): FlankToken[] {
  return (canvas.tokens.preview?.children ?? []).filter(isFlankToken);
}
