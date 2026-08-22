export interface Point {
  x: number;
  y: number;
}

/** Grid square: x = column, y = row. */
export interface Square {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function topLeft(squares: Square[]): Square {
  return squares.reduce(
    (acc, s) => ({ x: Math.min(acc.x, s.x), y: Math.min(acc.y, s.y) }),
    { x: Infinity, y: Infinity },
  );
}

/** Move a token's occupied squares so its top-left square lands on `to`. */
export function shiftSquares(squares: Square[], to: Square): Square[] {
  const ref = topLeft(squares);
  const dx = to.x - ref.x;
  const dy = to.y - ref.y;
  return squares.map((s) => ({ x: s.x + dx, y: s.y + dy }));
}

/** Squares between the two closest occupied squares. PF2e counts every diagonal as one square. */
export function squareGap(a: Square[], b: Square[]): number {
  let min = Infinity;
  for (const sa of a) {
    for (const sb of b) {
      const d = Math.max(Math.abs(sa.x - sb.x), Math.abs(sa.y - sb.y));
      if (d < min) min = d;
    }
  }
  return min;
}

export function withinReach(a: Square[], b: Square[], reachSquares: number): boolean {
  return squareGap(a, b) <= reachSquares;
}

export function overlaps(a: Square[], b: Square[]): boolean {
  return squareGap(a, b) === 0;
}

export function boundsOf(squares: Square[], gridSize: number): Bounds {
  const xs = squares.map((s) => s.x);
  const ys = squares.map((s) => s.y);
  return {
    left: Math.min(...xs) * gridSize,
    top: Math.min(...ys) * gridSize,
    right: (Math.max(...xs) + 1) * gridSize,
    bottom: (Math.max(...ys) + 1) * gridSize,
  };
}

export function centerOf(squares: Square[], gridSize: number): Point {
  const b = boundsOf(squares, gridSize);
  return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
}

function orientation(p: Point, q: Point, r: Point): number {
  const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (v === 0) return 0;
  return v > 0 ? 1 : -1;
}

export function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Same test the PF2e system uses: the line between two flankers must cross either both
 * vertical or both horizontal sides of the flankee's space.
 */
export function onOppositeSides(centerA: Point, centerB: Point, bounds: Bounds): boolean {
  const { left, right, top, bottom } = bounds;
  const crosses = (p: Point, q: Point) => segmentsIntersect(centerA, centerB, p, q);
  const hitsLeft = crosses({ x: left, y: top }, { x: left, y: bottom });
  const hitsRight = crosses({ x: right, y: top }, { x: right, y: bottom });
  const hitsTop = crosses({ x: left, y: top }, { x: right, y: top });
  const hitsBottom = crosses({ x: left, y: bottom }, { x: right, y: bottom });
  return (hitsLeft && hitsRight) || (hitsTop && hitsBottom);
}

/** Every square in the box of `radius` around `squares`, the occupied ones excluded. */
export function surroundingSquares(squares: Square[], radius: number): Square[] {
  const xs = squares.map((s) => s.x);
  const ys = squares.map((s) => s.y);
  const minX = Math.min(...xs) - radius;
  const maxX = Math.max(...xs) + radius;
  const minY = Math.min(...ys) - radius;
  const maxY = Math.max(...ys) + radius;
  const out: Square[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (!squares.some((s) => s.x === x && s.y === y)) out.push({ x, y });
    }
  }
  return out;
}
