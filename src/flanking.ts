import { onOppositeSides, withinReach, type Square } from "./geometry.ts";
import {
  boundsAt,
  centerAt,
  reachInSquares,
  squaresAt,
  wallBetween,
  type Token,
} from "./scene.ts";

export interface Options {
  wallsBlock: boolean;
}

export interface FlankPair {
  a: Token;
  b: Token;
}

/** Can this token threaten the flankee at all (rules side), optionally from a hypothetical square. */
export function canFlank(attacker: Token, flankee: Token, attackerAt?: Square): boolean {
  if (attacker === flankee) return false;
  const actor = attacker.actor;
  const target = flankee.actor;
  if (!actor || !target) return false;
  if (!actor.attributes?.flanking?.canFlank) return false;
  if (!target.attributes?.flanking?.flankable) return false;
  if (actor.canAttack === false) return false;
  if (actor.isAllyOf?.(target)) return false;
  return withinReach(squaresAt(attacker, attackerAt), squaresAt(flankee), reachInSquares(attacker));
}

export function isAlly(a: Token, b: Token): boolean {
  if (!a.actor || !b.actor) return false;
  if (a === b) return false;
  return !!a.actor.isAllyOf?.(b.actor) || a.actor === b.actor;
}

function opposite(attacker: Token, buddy: Token, flankee: Token, at: Square | undefined, opts: Options): boolean {
  const centerA = centerAt(attacker, at);
  const centerB = centerAt(buddy);
  if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) return false;
  return !(opts.wallsBlock && wallBetween(centerA, centerB));
}

/** Gang Up and friends: some feats flank on ally count alone. Companion-specific variants are not covered. */
function gangsUp(attacker: Token, buddies: Token[]): boolean {
  const canGangUp: unknown[] = attacker.actor?.attributes?.flanking?.canGangUp ?? [];
  return canGangUp.some(
    (g) => (typeof g === "number" && g <= buddies.length) || (g === true && buddies.length >= 1),
  );
}

/** Allies that let `attacker` flank `flankee` from `at`. Empty means no flank. */
export function buddiesFlanking(
  attacker: Token,
  flankee: Token,
  tokens: Token[],
  opts: Options,
  at?: Square,
): Token[] {
  if (!canFlank(attacker, flankee, at)) return [];
  const threatening = tokens.filter(
    (t) => t !== attacker && isAlly(attacker, t) && canFlank(t, flankee),
  );
  if (threatening.length === 0) return [];
  if (gangsUp(attacker, threatening)) return threatening;
  return threatening.filter((buddy) => opposite(attacker, buddy, flankee, at, opts));
}

/** Every enemy `attacker` would flank standing at `at`, with the allies making it work. */
export function flankedEnemies(
  attacker: Token,
  tokens: Token[],
  opts: Options,
  at?: Square,
): Map<Token, Token[]> {
  const result = new Map<Token, Token[]>();
  for (const enemy of tokens) {
    const buddies = buddiesFlanking(attacker, enemy, tokens, opts, at);
    if (buddies.length > 0) result.set(enemy, buddies);
  }
  return result;
}

/** Pairs of enemies flanking `flankee`. */
export function flankedBy(flankee: Token, tokens: Token[], opts: Options): FlankPair[] {
  const threats = tokens.filter((t) => canFlank(t, flankee));
  const pairs: FlankPair[] = [];
  for (let i = 0; i < threats.length; i++) {
    for (let j = i + 1; j < threats.length; j++) {
      const [a, b] = [threats[i], threats[j]];
      if (!isAlly(a, b)) continue;
      const centerA = centerAt(a);
      const centerB = centerAt(b);
      if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) continue;
      if (opts.wallsBlock && wallBetween(centerA, centerB)) continue;
      pairs.push({ a, b });
    }
  }
  if (pairs.length === 0) {
    const ganging = threats.find((t) => gangsUp(t, threats.filter((o) => o !== t && isAlly(t, o))));
    if (ganging) {
      const buddy = threats.find((t) => t !== ganging && isAlly(ganging, t));
      if (buddy) pairs.push({ a: ganging, b: buddy });
    }
  }
  return pairs;
}

/** Every token on the scene that is currently flanked, with the pair responsible. */
export function flankedTokens(tokens: Token[], opts: Options): Map<Token, FlankPair[]> {
  const result = new Map<Token, FlankPair[]>();
  for (const token of tokens) {
    const pairs = flankedBy(token, tokens, opts);
    if (pairs.length > 0) result.set(token, pairs);
  }
  return result;
}
