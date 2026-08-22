import { describe, expect, it } from "vitest";
import {
  boundsOf,
  centerOf,
  onOppositeSides,
  segmentsIntersect,
  shiftSquares,
  squareGap,
  surroundingSquares,
  withinReach,
  type Square,
} from "../src/geometry.ts";

const GRID = 100;
const medium = (x: number, y: number): Square[] => [{ x, y }];
const large = (x: number, y: number): Square[] => [
  { x, y },
  { x: x + 1, y },
  { x, y: y + 1 },
  { x: x + 1, y: y + 1 },
];

describe("squareGap", () => {
  it("counts diagonals as one square, PF2e style", () => {
    expect(squareGap(medium(0, 0), medium(1, 1))).toBe(1);
    expect(squareGap(medium(0, 0), medium(3, 1))).toBe(3);
  });

  it("measures from the closest occupied square of a big token", () => {
    expect(squareGap(large(0, 0), medium(2, 0))).toBe(1);
  });
});

describe("withinReach", () => {
  it("puts adjacent tokens inside 5ft reach and the next ring outside", () => {
    expect(withinReach(medium(0, 0), medium(1, 1), 1)).toBe(true);
    expect(withinReach(medium(0, 0), medium(2, 0), 1)).toBe(false);
    expect(withinReach(medium(0, 0), medium(2, 0), 2)).toBe(true);
  });
});

describe("shiftSquares", () => {
  it("moves a footprint by its top-left square", () => {
    expect(shiftSquares(large(0, 0), { x: 5, y: 7 })).toEqual([
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 5, y: 8 },
      { x: 6, y: 8 },
    ]);
  });
});

describe("onOppositeSides", () => {
  const target = boundsOf(medium(1, 1), GRID);

  it("flanks left-right", () => {
    const a = centerOf(medium(0, 1), GRID);
    const b = centerOf(medium(2, 1), GRID);
    expect(onOppositeSides(a, b, target)).toBe(true);
  });

  it("flanks corner to opposite corner", () => {
    const a = centerOf(medium(0, 0), GRID);
    const b = centerOf(medium(2, 2), GRID);
    expect(onOppositeSides(a, b, target)).toBe(true);
  });

  it("rejects adjacent allies on the same side", () => {
    const a = centerOf(medium(0, 1), GRID);
    const b = centerOf(medium(1, 0), GRID);
    expect(onOppositeSides(a, b, target)).toBe(false);
  });

  it("rejects a line that misses the target entirely", () => {
    const a = centerOf(medium(0, 3), GRID);
    const b = centerOf(medium(2, 3), GRID);
    expect(onOppositeSides(a, b, target)).toBe(false);
  });

  it("flanks a large target across its whole footprint", () => {
    const big = boundsOf(large(1, 1), GRID);
    const a = centerOf(medium(0, 1), GRID);
    const b = centerOf(medium(3, 2), GRID);
    expect(onOppositeSides(a, b, big)).toBe(true);
  });
});

describe("segmentsIntersect", () => {
  it("ignores parallel segments", () => {
    const hit = segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
    expect(hit).toBe(false);
  });
});

describe("surroundingSquares", () => {
  it("returns the ring box minus the occupied squares", () => {
    expect(surroundingSquares(medium(0, 0), 1)).toHaveLength(8);
    expect(surroundingSquares(large(0, 0), 1)).toHaveLength(16 - 4);
  });
});
