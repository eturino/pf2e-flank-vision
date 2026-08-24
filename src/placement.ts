import { squareGap, surroundingSquares, type Square } from "./geometry.ts";
import { buddiesFlanking, canFlank, isAlly, type Options } from "./flanking.ts";
import type { FlankToken } from "./pf2e.ts";
import { canOccupy, gridDistance, occupiedSquares, reachInFeet, squaresAt } from "./scene.ts";

export interface PlacementLimits {
  /** Ignore enemies further away than this many squares. */
  searchRadius: number;
  /** Stop after this many squares, so a crowded scene cannot stall the canvas. */
  maxSquares: number;
}

/** Squares where `token` could stand and flank something, given where its allies already are. */
export function flankingPlacements(
  token: FlankToken,
  tokens: FlankToken[],
  opts: Options,
  limits: PlacementLimits,
): Square[] {
  const own = occupiedSquares(token);
  const span = Math.max(...own.map((s) => s.x)) - Math.min(...own.map((s) => s.x)) + 1;
  // scan radius only - the real reach test happens in canFlank, under PF2e's own distance rules
  const reach = Math.ceil(reachInFeet(token) / gridDistance());
  const found = new Map<string, Square>();

  const enemies = tokens.filter(
    (enemy) =>
      !isAlly(token, enemy) &&
      enemy !== token &&
      enemy.actor.attributes.flanking.flankable &&
      squareGap(own, squaresAt(enemy)) <= limits.searchRadius &&
      // no ally threatening it means no square of ours can flank it
      tokens.some((ally) => isAlly(token, ally) && canFlank(ally, enemy)),
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
