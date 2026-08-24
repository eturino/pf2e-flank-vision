import type Token from "@client/canvas/placeables/token.mjs";

/** The PF2e flanking data this module reads off an actor. */
export interface FlankingAttributes {
  canFlank: boolean;
  flankable: boolean;
  /** Gang Up and friends: `true`, an ally count, or a companion keyword. */
  canGangUp: (number | boolean | string)[];
}

export interface FlankActor extends Actor<TokenDocument<Scene> | null> {
  attributes: { flanking: FlankingAttributes };
  canAttack: boolean;
  isAllyOf(other: FlankActor): boolean;
  /** Creature size in feet; absent on actors that are not creatures. */
  dimensions?: { height: number };
  getReach(options: { action: "attack" | "interact" }): number;
}

/** A placed token whose actor carries PF2e's flanking data. `isFlankToken` guarantees the actor. */
export interface FlankToken extends Token<TokenDocument<Scene>> {
  actor: FlankActor;
}

/**
 * The single boundary between Foundry's types and PF2e's. Everything downstream is typed;
 * tokens without a PF2e creature actor (drawings of doors, actorless tokens) never get past here.
 */
export function isFlankToken(token: unknown): token is FlankToken {
  if (typeof token !== "object" || token === null) return false;
  if (!("actor" in token) || !("document" in token)) return false;
  const actor = token.actor;
  if (typeof actor !== "object" || actor === null) return false;
  if (!("attributes" in actor) || !("getReach" in actor) || !("isAllyOf" in actor)) return false;
  if (typeof actor.getReach !== "function" || typeof actor.isAllyOf !== "function") return false;
  const attributes = actor.attributes;
  return typeof attributes === "object" && attributes !== null && "flanking" in attributes;
}
