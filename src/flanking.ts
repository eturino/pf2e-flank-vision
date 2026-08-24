import { withinReach } from "./distance.ts";
import { onOppositeSides, type Square } from "./geometry.ts";
import type { FlankToken } from "./pf2e.ts";
import { boundsAt, centerAt, footprintAt, gridDistance, reachInFeet, wallBetween } from "./scene.ts";

export interface Options {
  wallsBlock: boolean;
}

export interface FlankPair {
  a: FlankToken;
  b: FlankToken;
}

/** Can this token threaten the flankee at all (rules side), optionally from a hypothetical square. */
export function canFlank(attacker: FlankToken, flankee: FlankToken, attackerAt?: Square): boolean {
  if (attacker === flankee) return false;
  const actor = attacker.actor;
  const target = flankee.actor;
  if (!actor.attributes.flanking.canFlank) return false;
  if (!target.attributes.flanking.flankable) return false;
  if (!actor.canAttack) return false;
  if (attacker.document.hidden || flankee.document.hidden) return false;
  if (actor.isAllyOf(target)) return false;
  const reach = reachInFeet(attacker);
  return withinReach(footprintAt(attacker, attackerAt), footprintAt(flankee), reach, gridDistance());
}

export function isAlly(a: FlankToken, b: FlankToken): boolean {
  if (a === b) return false;
  return a.actor.isAllyOf(b.actor) || a.actor === b.actor;
}

function opposite(attacker: FlankToken, buddy: FlankToken, flankee: FlankToken, at: Square | undefined, opts: Options): boolean {
  const centerA = centerAt(attacker, at);
  const centerB = centerAt(buddy);
  if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) return false;
  return !(opts.wallsBlock && wallBetween(centerA, centerB));
}

/**
 * Gang Up and friends: some feats flank on ally count alone. The feat only ever benefits the
 * creature that has it - "any enemy you're adjacent to is off-guard as long as it's within reach
 * of at least one of your allies" - so an ally's Gang Up grants nothing here. Companion-specific
 * variants are not covered either.
 */
function gangsUp(attacker: FlankToken, buddies: FlankToken[]): boolean {
  return attacker.actor.attributes.flanking.canGangUp.some(
    (g) => (typeof g === "number" && g <= buddies.length) || (g === true && buddies.length >= 1),
  );
}

/** Allies threatening `flankee` that would pair with `attacker`, given who already threatens it. */
function buddiesAmong(
  attacker: FlankToken,
  flankee: FlankToken,
  threats: FlankToken[],
  opts: Options,
  at?: Square,
): FlankToken[] {
  const threatening = threats.filter((t) => t !== attacker && isAlly(attacker, t));
  if (threatening.length === 0) return [];
  if (gangsUp(attacker, threatening)) return threatening;
  return threatening.filter((buddy) => opposite(attacker, buddy, flankee, at, opts));
}

/** Allies that let `attacker` flank `flankee` from `at`. Empty means no flank. */
export function buddiesFlanking(
  attacker: FlankToken,
  flankee: FlankToken,
  tokens: FlankToken[],
  opts: Options,
  at?: Square,
): FlankToken[] {
  if (!canFlank(attacker, flankee, at)) return [];
  return buddiesAmong(attacker, flankee, threatsAgainst(flankee, tokens), opts, at);
}

/** Every enemy `attacker` would flank standing at `at`, with the allies making it work. */
export function flankedEnemies(
  attacker: FlankToken,
  tokens: FlankToken[],
  opts: Options,
  at?: Square,
): Map<FlankToken, FlankToken[]> {
  const result = new Map<FlankToken, FlankToken[]>();
  for (const enemy of tokens) {
    const buddies = buddiesFlanking(attacker, enemy, tokens, opts, at);
    if (buddies.length > 0) result.set(enemy, buddies);
  }
  return result;
}

/**
 * Pairs of tokens flanking `flankee`, deduplicated. The threat set is resolved once for the
 * flankee and shared across every attacker - recomputing it per attacker made this cubic in
 * `canFlank`, which is the expensive call.
 */
export function flankedBy(flankee: FlankToken, tokens: FlankToken[], opts: Options): FlankPair[] {
  const threats = threatsAgainst(flankee, tokens);
  const seen = new Set<string>();
  const pairs: FlankPair[] = [];
  for (const attacker of threats) {
    for (const buddy of buddiesAmong(attacker, flankee, threats, opts)) {
      const key = [attacker.id, buddy.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: attacker, b: buddy });
    }
  }
  return pairs;
}

/** Every token on the scene that is currently flanked, with the pair responsible. */
export function flankedTokens(tokens: FlankToken[], opts: Options): Map<FlankToken, FlankPair[]> {
  const result = new Map<FlankToken, FlankPair[]>();
  for (const token of tokens) {
    const pairs = flankedBy(token, tokens, opts);
    if (pairs.length > 0) result.set(token, pairs);
  }
  return result;
}

function threatsAgainst(flankee: FlankToken, tokens: FlankToken[]): FlankToken[] {
  return tokens.filter((t) => canFlank(t, flankee));
}
