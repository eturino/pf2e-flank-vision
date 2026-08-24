# Changelog

## 0.2.0

First tagged release. Everything below came out of a review of the initial implementation and a
live pass in Foundry.

Shipping at `0.x` deliberately: the rules are unit-tested against stub tokens and the distance
maths is ported from the system's own measurement, but only part of the path from a real PF2e
actor to the overlay has been walked in play. The README table under "Verifying in Foundry" says
which rows are confirmed and which are not. The reach, elevation, visibility and grid changes in
this release are among the unconfirmed ones.

### Rules

- **Reach is measured PF2e's way.** Diagonals alternate 5/10, so two diagonal steps are 15 feet,
  not the 10 a Chebyshev count gives. `src/distance.ts` ports the system's own measurement,
  including the CRB p.455 carve-out that lets a 10-foot reach cover two diagonal squares. The
  carve-out no longer applies when the reach also has to climb. Reach is compared in feet rather
  than rounded into squares.
- **Elevation is a third axis**, using each creature's vertical span. A flyer overhead is no
  longer flanked by two melee on the ground. Spans that merely touch are a step apart, not the
  same space.
- **Hidden tokens flank for nobody**, matching the system. Non-GM clients only reason about
  tokens they can see, so the overlay cannot leak the position of a token a player cannot
  perceive.
- **Gang Up stays with the feat holder.** An ally's Gang Up grants nothing: "any enemy you're
  adjacent to is off-guard as long as it's within reach of at least one of your allies".

### Canvas

- **A token that is moving is measured from where it lands.** Foundry v14 interpolates
  `document.x/y` through the move animation, so the overlay used to stay on the square a token
  came from until something else forced a redraw. Details in
  [docs/foundry-v14-canvas-notes.md](docs/foundry-v14-canvas-notes.md).
- **Non-square grids bail** with a one-per-scene warning instead of drawing square-grid geometry
  on hexes.
- **`refreshToken` is gated on a live drag preview**, plus the one frame the clone disappears. It
  fires per animation frame per token into an O(tokens^2) recompute.
- **Coalesced renders collapse instead of being discarded.** A request arriving during a pending
  frame buys one more frame.
- **`flankedBy` resolves the threat set once per flankee** rather than once per attacker, which
  had made `flankedTokens` cubic in the expensive call.
- **The overlay survives a teardown race.** `clear()` throws on a destroyed `Graphics` and it is
  the first line of every render, so one race would have stopped all drawing permanently.
- Wall hooks added so `wallsBlock` refreshes on wall edits; dead hooks removed.
- `maxSquares: 0` now means none rather than one.

### Packaging

- Tagging `vX.Y.Z` builds, tests and publishes `module.json` + `module.zip`. `module.json` is the
  single source of truth for the version and the workflow refuses a tag that disagrees with it.
- The published manifest keeps pointing at `releases/latest` so installed copies still find the
  next version; only its `download` is pinned to the tag.
- CI runs typecheck, test and build on every push and PR, plus a stale-dist guard that rebuilds
  and fails if the committed bundle differs from `src/`.

### Internals

- Types come from `@dfreds/foundry-types`. No `any` and no type assertions; `isFlankToken` is the
  single runtime-checked boundary, and test stubs go through it too.
- Colours moved to `CONFIG.pf2eFlankVision.colors`, so a world can restyle the overlay from a
  macro without a rebuild.
- `CONFIG.pf2eFlankVision.debug` traces every render request, frame and draw.
- The Alt+F keybinding was dropped: core Foundry binds bare Alt to highlight-objects, so it would
  flash that overlay every time. Reasoning in `docs/2026-08-23-review.md`.

## 0.1.0

Initial implementation. Never released.
