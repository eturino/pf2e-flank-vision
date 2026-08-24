import type { Square } from "./geometry.ts";

/** A token's footprint: the squares it stands on plus the vertical span it occupies, in feet. */
export interface Footprint {
  squares: Square[];
  elevation: number;
  /** Creature height in feet; PF2e measures elevation between vertical spans, not points. */
  height: number;
}

interface Span {
  min: number;
  max: number;
}

function extent(squares: Square[], axis: "x" | "y"): Span {
  const values = squares.map((square) => square[axis]);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function spansOverlap(a: Span, b: Span): boolean {
  return a.min <= b.max && b.min <= a.max;
}

/** Squares crossed along one axis: 1 when the two footprints share it, else the gap plus one. */
function axisSteps(a: Span, b: Span): number {
  return Math.max(a.min - b.max - 1, b.min - a.max - 1, 0) + 1;
}

/**
 * Elevation spans are feet, not square indices, so two spans that merely touch (a creature on
 * the ground and one hovering exactly one square above it) are a step apart, not overlapping.
 */
function elevationSteps(a: Footprint, b: Footprint, gridDistance: number): number {
  const spanA: Span = { min: a.elevation, max: a.elevation + a.height };
  const spanB: Span = { min: b.elevation, max: b.elevation + b.height };
  if (spanA.min < spanB.max && spanB.min < spanA.max) return 0;
  const gap = Math.max(spanA.min - spanB.max, spanB.min - spanA.max, 0);
  return Math.ceil(gap / gridDistance) + 1;
}

/**
 * Distance in feet under PF2e's grid rules, ported from the system's own `measureDistanceOnGrid`:
 * diagonals alternate 5/10, so two diagonal steps are 15 feet rather than the 10 a naive
 * Chebyshev count gives. `reach` only matters for the CRB carve-out that lets a 10-foot reach
 * cover two diagonal squares.
 */
export function measureDistanceFeet(
  a: Footprint,
  b: Footprint,
  { gridDistance, reach }: { gridDistance: number; reach?: number },
): number {
  const [ax, ay] = [extent(a.squares, "x"), extent(a.squares, "y")];
  const [bx, by] = [extent(b.squares, "x"), extent(b.squares, "y")];

  const sharesFootprint = spansOverlap(ax, bx) && spansOverlap(ay, by);
  const elevation = elevationSteps(a, b, gridDistance);
  const steps = [
    sharesFootprint ? 0 : axisSteps(ax, bx),
    sharesFootprint ? 0 : axisSteps(ay, by),
    elevation,
  ].sort((left, right) => left - right);

  const doubleDiagonal = steps[0] ?? 0;
  const diagonal = (steps[1] ?? 0) - doubleDiagonal;
  const straight = (steps[2] ?? 0) - (steps[1] ?? 0);

  // "Unlike with measuring most distances, 10-foot reach can reach 2 squares diagonally." (CRB 455)
  // The carve-out is written about squares on the map, so it does not apply once the reach has
  // to climb as well.
  const reduction = elevation === 0 && diagonal > 1 && reach === 10 ? 1 : 0;
  const squares = Math.floor(doubleDiagonal * 1.75 + diagonal * 1.5 + straight) - reduction;
  return squares * gridDistance;
}

export function withinReach(a: Footprint, b: Footprint, reach: number, gridDistance: number): boolean {
  return measureDistanceFeet(a, b, { gridDistance, reach }) <= reach;
}
