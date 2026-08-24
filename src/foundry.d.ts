// Keep or else Foundry globals like Hooks and PIXI will not resolve
/// <reference types="@dfreds/foundry-types" />

import type Canvas from "@client/canvas/board.mjs";
import type Actors from "@client/documents/collections/actors.mjs";
import type Game from "@client/game.mjs";
import type { FlankColors } from "./colors.ts";

declare global {
  // The types package leaves `game` and `canvas` to the game system, which types them against
  // its own document classes. We only need the core shapes.
  const game: Game<Actor<null>, Actors<Actor<null>>, ChatMessage, Combat, Item<null>, Macro, Scene, User>;
  const canvas: Canvas;

  /** Narrowed to the one notification channel this module uses. */
  const ui: { notifications: { warn(message: string): void } };

  /** Narrowed to what this module reads: the full Config interface takes 21 type parameters. */
  const CONFIG: {
    Canvas: {
      objectBorderThickness: number;
      dispositionColors: Record<string, number>;
      polygonBackends: {
        move: {
          testCollision(
            origin: { x: number; y: number },
            destination: { x: number; y: number },
            options: { type: string; mode: string },
          ): boolean;
        };
      };
    };
    pf2eFlankVision: { colors: FlankColors; debug: boolean };
  };
}
