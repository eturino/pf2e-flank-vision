import { beforeAll, describe, expect, it } from "vitest";
import { buddiesFlanking, flankedBy, flankedEnemies, type Options } from "../src/flanking.ts";
import { flankingPlacements } from "../src/placement.ts";

const GRID = 100;
const OPTS: Options = { wallsBlock: false };

beforeAll(() => {
  (globalThis as any).canvas = {
    grid: { size: GRID },
    dimensions: { distance: 5, sceneRect: { x: -1000, y: -1000, width: 4000, height: 4000 } },
  };
});

interface Spec {
  side: "party" | "foe";
  x: number;
  y: number;
  size?: number;
  reach?: number;
  gangUp?: (number | true)[];
  flankable?: boolean;
}

function token(name: string, spec: Spec): any {
  const size = spec.size ?? 1;
  const offsets = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) offsets.push({ i: spec.y + i, j: spec.x + j });
  }
  const actor: any = {
    attributes: { flanking: { canFlank: true, flankable: spec.flankable ?? true, canGangUp: spec.gangUp ?? [] } },
    canAttack: true,
    getReach: () => spec.reach ?? 5,
  };
  actor.isAllyOf = (other: any) => other.side === spec.side;
  actor.side = spec.side;
  return {
    name,
    id: name,
    actor,
    document: {
      x: spec.x * GRID,
      y: spec.y * GRID,
      width: size,
      height: size,
      hidden: false,
      getOccupiedGridSpaceOffsets: () => offsets,
    },
  };
}

describe("flanking rules", () => {
  it("flanks an enemy pinned between two allies", () => {
    const hero = token("hero", { side: "party", x: 0, y: 1 });
    const ally = token("ally", { side: "party", x: 2, y: 1 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1 });
    const tokens = [hero, ally, ogre];

    expect(buddiesFlanking(hero, ogre, tokens, OPTS)).toEqual([ally]);
    expect([...flankedEnemies(hero, tokens, OPTS).keys()]).toEqual([ogre]);
    expect(flankedBy(ogre, tokens, OPTS)).toHaveLength(1);
  });

  it("does not flank from the same side", () => {
    const hero = token("hero", { side: "party", x: 0, y: 1 });
    const ally = token("ally", { side: "party", x: 1, y: 0 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1 });

    expect(buddiesFlanking(hero, ogre, [hero, ally, ogre], OPTS)).toEqual([]);
  });

  it("needs reach to cover the gap", () => {
    const hero = token("hero", { side: "party", x: 0, y: 1 });
    const ally = token("ally", { side: "party", x: 3, y: 1 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1, size: 2 });
    const tokens = [hero, ally, ogre];

    expect(buddiesFlanking(hero, ogre, tokens, OPTS)).toEqual([ally]);

    const shortReachAlly = token("ally", { side: "party", x: 4, y: 1 });
    expect(buddiesFlanking(hero, ogre, [hero, shortReachAlly, ogre], OPTS)).toEqual([]);

    const reachAlly = token("reach", { side: "party", x: 4, y: 1, reach: 10 });
    expect(buddiesFlanking(hero, ogre, [hero, reachAlly, ogre], OPTS)).toEqual([reachAlly]);
  });

  it("reports the enemy pair flanking you", () => {
    const hero = token("hero", { side: "party", x: 1, y: 1 });
    const wolfA = token("wolfA", { side: "foe", x: 0, y: 1 });
    const wolfB = token("wolfB", { side: "foe", x: 2, y: 1 });

    const pairs = flankedBy(hero, [hero, wolfA, wolfB], OPTS);
    expect(pairs).toEqual([{ a: wolfA, b: wolfB }]);
  });

  it("honours Gang Up, which ignores positioning", () => {
    const hero = token("hero", { side: "party", x: 0, y: 1, gangUp: [true] });
    const ally = token("ally", { side: "party", x: 1, y: 0 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1 });

    expect(buddiesFlanking(hero, ogre, [hero, ally, ogre], OPTS)).toEqual([ally]);
  });

  it("leaves unflankable enemies alone", () => {
    const hero = token("hero", { side: "party", x: 0, y: 1 });
    const ally = token("ally", { side: "party", x: 2, y: 1 });
    const ooze = token("ooze", { side: "foe", x: 1, y: 1, flankable: false });

    expect(buddiesFlanking(hero, ooze, [hero, ally, ooze], OPTS)).toEqual([]);
  });
});

describe("flankingPlacements", () => {
  it("offers the squares opposite the ally and nothing else", () => {
    const hero = token("hero", { side: "party", x: 5, y: 5 });
    const ally = token("ally", { side: "party", x: 0, y: 1 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1 });
    const squares = flankingPlacements(hero, [hero, ally, ogre], OPTS, {
      searchRadius: 12,
      maxSquares: 100,
    });

    expect(squares).toContainEqual({ x: 2, y: 1 });
    expect(squares).not.toContainEqual({ x: 1, y: 0 });
    expect(squares).not.toContainEqual({ x: 0, y: 1 }); // the ally stands there
  });

  it("stops at the configured limit", () => {
    const hero = token("hero", { side: "party", x: 5, y: 5 });
    const ally = token("ally", { side: "party", x: 0, y: 1 });
    const ogre = token("ogre", { side: "foe", x: 1, y: 1 });
    const squares = flankingPlacements(hero, [hero, ally, ogre], OPTS, {
      searchRadius: 12,
      maxSquares: 1,
    });

    expect(squares).toHaveLength(1);
  });
});
