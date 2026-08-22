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
  if (!actor || !target) return false;
  if (!actor.attributes?.flanking?.canFlank) return false;
  if (!target.attributes?.flanking?.flankable) return false;
  if (!actor.canAttack) return false;
  if (attacker.document.hidden || flankee.document.hidden) return false;
  if (actor.isAllyOf?.(target)) return false;
  const reach = reachInFeet(attacker);
  return withinReach(footprintAt(attacker, attackerAt), footprintAt(flankee), reach, gridDistance());
}

export function isAlly(a: FlankToken, b: FlankToken): boolean {
  if (!a.actor || !b.actor) return false;
  if (a === b) return false;
  return !!a.actor.isAllyOf?.(b.actor) || a.actor === b.actor;
}

function opposite(attacker: FlankToken, buddy: FlankToken, flankee: FlankToken, at: Square | undefined, opts: Options): boolean {
  const centerA = centerAt(attacker, at);
  const centerB = centerAt(buddy);
  if (!onOppositeSides(centerA, centerB, boundsAt(flankee))) return false;
  return !(opts.wallsBlock && wallBetween(centerA, centerB));
}

/** Gang Up and friends: some feats flank on ally count alone. Companion-specific variants are not covered. */
function gangsUp(attacker: FlankToken, buddies: FlankToken[]): boolean {
  const own = attacker.actor?.attributes.flanking.canGangUp ?? [];
  if (own.some((g) => (typeof g === "number" && g <= buddies.length) || (g === true && buddies.length >= 1))) {
    return true;
  }
  // an ally with Gang Up grants the flank to whoever it is ganging up with, not just itself
  return buddies.some((buddy) => (buddy.actor?.attributes.flanking.canGangUp ?? []).some((g) => g === true));
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
  const threatening = tokens.filter(
    (t) => t !== attacker && isAlly(attacker, t) && canFlank(t, flankee),
  );
  if (threatening.length === 0) return [];
  if (gangsUp(attacker, threatening)) return threatening;
  return threatening.filter((buddy) => opposite(attacker, buddy, flankee, at, opts));
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

/** Pairs of tokens flanking `flankee`, deduplicated. Reuses the same rules path as everything else. */
export function flankedBy(flankee: FlankToken, tokens: FlankToken[], opts: Options): FlankPair[] {
  const seen = new Set<string>();
  const pairs: FlankPair[] = [];
  for (const attacker of tokens) {
    for (const buddy of buddiesFlanking(attacker, flankee, tokens, opts)) {
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
