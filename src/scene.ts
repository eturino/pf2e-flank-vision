import {
  boundsOf,
  centerOf,
  overlaps,
  shiftSquares,
  type Bounds,
  type Point,
  type Square,
} from "./geometry.ts";
import { isFlankToken, type FlankToken } from "./pf2e.ts";

export function gridSize(): number {
  return canvas.grid.size;
}

/** Feet (or whatever unit) covered by one grid square. */
export function gridDistance(): number {
  return canvas.dimensions?.distance || 5;
}

export function occupiedSquares(token: FlankToken): Square[] {
  const offsets = token.document.getOccupiedGridSpaceOffsets();
  if (offsets.length > 0) return offsets.map((offset) => ({ x: offset.j, y: offset.i }));

  // gridless scenes and anything else without offsets: fall back to the token's own footprint
  const size = gridSize();
  const originX = Math.floor(token.document.x / size);
  const originY = Math.floor(token.document.y / size);
  const squares: Square[] = [];
  for (let x = 0; x < Math.max(1, Math.round(token.document.width)); x++) {
    for (let y = 0; y < Math.max(1, Math.round(token.document.height)); y++) {
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

export function reachInSquares(token: FlankToken): number {
  const feet = token.actor?.getReach({ action: "attack" }) ?? gridDistance();
  return Math.max(1, Math.round(feet / gridDistance()));
}

export function squareOf(token: FlankToken): Square {
  const size = gridSize();
  return { x: Math.round(token.document.x / size), y: Math.round(token.document.y / size) };
}

/** Tokens a player is allowed to reason about: hidden ones only for the GM. */
export function visibleTokens(): FlankToken[] {
  const isGM = game.user.isGM;
  return canvas.tokens.placeables
    .filter(isFlankToken)
    .filter((token) => !token.isPreview && (isGM || !token.document.hidden));
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
  const backend = CONFIG.Canvas.polygonBackends?.move;
  if (!backend) return false;
  return backend.testCollision(a, b, { type: "move", mode: "any" });
}

/** The token whose situation we report on: the controlled one, else the assigned character. */
export function focusToken(): FlankToken | null {
  const controlled = canvas.tokens.controlled.filter(isFlankToken);
  const first = controlled.at(0);
  if (first) return first;
  const character = game.user.character;
  if (!character) return null;
  return visibleTokens().find((token) => token.actor?.id === character.id) ?? null;
}

/** Drag clones live on the preview layer while a token is being moved. */
export function previewTokens(): FlankToken[] {
  return (canvas.tokens.preview?.children ?? []).filter(isFlankToken);
}
