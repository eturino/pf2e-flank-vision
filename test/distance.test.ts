import { describe, expect, it } from "vitest";
import { measureDistanceFeet, withinReach, type Footprint } from "../src/distance.ts";
import type { Square } from "../src/geometry.ts";

const FEET_PER_SQUARE = 5;

function at(x: number, y: number, { size = 1, elevation = 0, height = 5 } = {}): Footprint {
  const squares: Square[] = [];
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) squares.push({ x: x + dx, y: y + dy });
  }
  return { squares, elevation, height };
}

const feet = (a: Footprint, b: Footprint, reach?: number): number =>
  measureDistanceFeet(a, b, { gridDistance: FEET_PER_SQUARE, reach });

describe("measureDistanceFeet", () => {
  it("counts adjacency as 5 feet, orthogonally and diagonally", () => {
    expect(feet(at(0, 0), at(1, 0))).toBe(5);
    expect(feet(at(0, 0), at(1, 1))).toBe(5);
  });

  it("alternates diagonals 5/10 the way PF2e does", () => {
    expect(feet(at(0, 0), at(2, 0))).toBe(10);
    // two diagonal steps: 5 + 10, not the 10 a Chebyshev count would give
    expect(feet(at(0, 0), at(2, 2))).toBe(15);
    expect(feet(at(0, 0), at(3, 3))).toBe(20);
    // one diagonal then two straights: 5 + 5 + 5
    expect(feet(at(0, 0), at(3, 1))).toBe(15);
  });

  it("applies the 10-foot reach carve-out for two diagonal squares", () => {
    expect(feet(at(0, 0), at(2, 2))).toBe(15);
    expect(feet(at(0, 0), at(2, 2), 10)).toBe(10);
    // the carve-out is reach-10 only
    expect(feet(at(0, 0), at(2, 2), 15)).toBe(15);
  });

  it("measures from the nearest square of a large token", () => {
    expect(feet(at(0, 0, { size: 2 }), at(2, 0))).toBe(5);
    expect(feet(at(0, 0, { size: 2 }), at(3, 0))).toBe(10);
  });

  it("treats overlapping footprints as zero", () => {
    expect(feet(at(0, 0), at(0, 0))).toBe(0);
  });

  it("counts elevation as a third axis", () => {
    // a medium creature hovering 10 feet up is two squares away, not one
    expect(feet(at(0, 0), at(1, 0, { elevation: 10 }))).toBe(10);
    // a flyer well overhead is not adjacent
    expect(feet(at(0, 0), at(1, 0, { elevation: 30 }))).toBe(30);
  });
});

describe("withinReach", () => {
  it("keeps a 5-foot reach to adjacent squares", () => {
    expect(withinReach(at(0, 0), at(1, 1), 5, FEET_PER_SQUARE)).toBe(true);
    expect(withinReach(at(0, 0), at(2, 0), 5, FEET_PER_SQUARE)).toBe(false);
  });

  it("lets 10-foot reach cover two diagonal squares but not three", () => {
    expect(withinReach(at(0, 0), at(2, 2), 10, FEET_PER_SQUARE)).toBe(true);
    expect(withinReach(at(0, 0), at(3, 3), 10, FEET_PER_SQUARE)).toBe(false);
  });

  it("stops a 15-foot reach where Chebyshev counting would have allowed it", () => {
    // three squares diagonally is 20 feet under PF2e counting, not 15
    expect(withinReach(at(0, 0), at(3, 3), 15, FEET_PER_SQUARE)).toBe(false);
    expect(withinReach(at(0, 0), at(3, 0), 15, FEET_PER_SQUARE)).toBe(true);
  });

  it("does not reach a flyer overhead", () => {
    expect(withinReach(at(0, 0), at(1, 0, { elevation: 30 }), 10, FEET_PER_SQUARE)).toBe(false);
  });
});
