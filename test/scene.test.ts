import { beforeAll, describe, expect, it } from "vitest";
import { isSupportedGrid } from "../src/scene.ts";

const grid = { type: 1 };

beforeAll(() => {
  Object.defineProperty(globalThis, "canvas", { configurable: true, value: { grid } });
  Object.defineProperty(globalThis, "CONST", {
    configurable: true,
    value: { GRID_TYPES: { GRIDLESS: 0, SQUARE: 1, HEXODDR: 2 } },
  });
});

describe("isSupportedGrid", () => {
  it("takes square grids and nothing else", () => {
    grid.type = 1;
    expect(isSupportedGrid()).toBe(true);
    grid.type = 0;
    expect(isSupportedGrid()).toBe(false);
    grid.type = 2;
    expect(isSupportedGrid()).toBe(false);
  });
});
