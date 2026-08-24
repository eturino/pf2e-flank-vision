# PF2e Flank Vision

Live flanking feedback for Pathfinder 2e on Foundry VTT v14.

The PF2e system already knows the flanking rules and can draw flanking lines, but only
while you *target* a token and hold the highlight-objects key. This module answers the
questions that come up mid-combat without any of that ceremony:

- **Who is flanked right now** - every flanked token on the scene gets an outline.
- **What am I flanking** - the enemies your selected token flanks, with a line to the ally
  making it work.
- **Am I flanked** - your token is outlined in red, with a line between the two enemies
  responsible.
- **Where could I stand** - dots on every square you could move to in order to flank an
  enemy with an ally already in place (off by default, it is the expensive one).
- **What happens if I move there** - while you drag a token, the whole picture is
  recomputed for the square you are hovering over, not the one you left.

Rules come from the system's own actor data (`attributes.flanking`, `getReach`,
`isAllyOf`), so reach weapons, Lunge, size, unflankable creatures and Gang Up are all
respected. It does not depend on the system's flanking automation setting.

https://github.com/user-attachments/assets/8a92214d-ca6c-420f-8c3d-f3a1cb53e27b

## Requirements

Foundry VTT v14, PF2e system v8, and a **square-grid scene**.

Hexagonal and gridless scenes are not supported. PF2e's flanking rules are written in grid
squares, and so is everything this module measures - reach, footprints, the squares you could
move to. On a non-square scene the module draws nothing and warns once, rather than showing
outlines and distances that would be quietly wrong. Every other scene on the world keeps working.


## Install

Add-on module manifest URL:

```
https://github.com/eturino/pf2e-flank-vision/releases/latest/download/module.json
```

Releasing is: bump `version` in `module.json`, commit, tag `vX.Y.Z`. The workflow refuses the
tag if the two disagree, then builds, tests and publishes `module.json` + `module.zip` as
release assets. The published manifest keeps pointing at `releases/latest` so installed copies
still find the next version; only its `download` is pinned to the tag.

On the media server the module is a git clone, so updates are a pull:

```bash
cd ~/foundry-vtt-data/Data/modules
git clone git@github.com:eturino/pf2e-flank-vision.git   # first time
cd pf2e-flank-vision && git pull                         # updates
```

`dist/` is committed on purpose - the server has no node toolchain, so a pull is enough. CI
rebuilds and fails if the committed bundle does not match `src/`, so a source fix can never ship
without its build.

## Settings

All client-scoped, so each player picks their own overlays. There is deliberately no keybinding
yet - see Known limits.

| Setting | Default | What it does |
| --- | --- | --- |
| Enable flank vision | on | Master switch |
| Mark flanked tokens | on | Outline every flanked token |
| Selected token status | on | What you flank / who flanks you |
| Preview while dragging | on | Recompute for the prospective square |
| Show flanking positions | off | Dots on squares you could flank from |
| Walls break flanking | off | House rule; the rules do not require line of effect between flankers |
| Position search radius | 12 | Squares; ignore enemies further away when hunting positions |
| Position limit | 400 | Stop after this many dots |

## Development

```bash
pnpm install
pnpm test        # geometry + flanking rules, no Foundry needed
pnpm typecheck
pnpm build       # esbuild -> dist/flank-vision.js
pnpm watch
```

`src/geometry.ts` and `src/distance.ts` are pure math and unit-tested - the latter is a port of
PF2e's own grid measurement (diagonals alternate 5/10). `src/flanking.ts` holds the rules, tested
against stub tokens that are pushed through the same runtime guard real tokens go through.
`src/scene.ts` is the only place that talks to Foundry's canvas API, `src/draw.ts` the only place
that draws, and `src/colors.ts` puts the palette on `CONFIG.pf2eFlankVision.colors` so a world
can restyle the overlay from a macro.

`CONFIG.pf2eFlankVision.debug = true` traces every render request, frame and draw to the console
with the position each one measured from. The overlay depends on canvas timing no unit test can
reach, so this is how the last bug in it was found - reach for it before reasoning about frame
ordering.

[docs/foundry-v14-canvas-notes.md](docs/foundry-v14-canvas-notes.md) is the reading before
touching `src/scene.ts` or the hooks in `src/main.ts`: how v14 animates a token's position, why
`movement.state` cannot tell you a token is moving, why a drag clone inverts which source to
trust, and the hook order on a drop.

Types come from `@dfreds/foundry-types` (the PF2e system's own definitions, versioned to Foundry
builds). There is no `any` and no type assertion in the codebase; `isFlankToken` in `src/pf2e.ts`
is the single boundary.

## Known limits

- **Square grids only** (see Requirements). Hex and gridless scenes are skipped with a warning.
- Multi-token drags preview only the first token.
- Gang Up is supported in its numeric/always form; the Animal Companion (Side by Side)
  and eidolon variants are not.
- The draw is O(tokens^2) with no caching, recomputed at most once per animation frame.
- Flanking positions ignore terrain cost and difficult terrain - they answer "could I
  flank from there", not "can I get there this turn".
- The overlay answers the rules question, not the automation one: with the system's flanking
  automation disabled it still shows flanks the system will not turn into off-guard.
- No keybinding. Core Foundry binds bare Alt to highlight-objects, so the obvious Alt+F would
  flash that overlay every time; the proposal for adding a non-Alt chord back is at the end of
  [docs/2026-08-23-review.md](docs/2026-08-23-review.md).

## Known gaps in the tests

Worth knowing before trusting a green run:

- `wallsBlock` is never exercised, and the flanking tests stub no `CONFIG`, so the first test to
  enable it would throw in `wallBetween`.
- Nothing asserts that a placement square is rejected for falling outside the scene rectangle.
- Everything under "Verifying in Foundry" below is unreachable from a unit test.

## History

- [CHANGELOG.md](CHANGELOG.md) - what shipped in each version.
- [docs/foundry-v14-canvas-notes.md](docs/foundry-v14-canvas-notes.md) - v14 canvas behaviour this
  module depends on, and the traps in it.
- [docs/2026-08-23-review.md](docs/2026-08-23-review.md) - the two-agent review of the first
  implementation: what was wrong (reach measurement, elevation, hidden tokens, non-square grids),
  what was fixed, and what is deliberately left alone.

## Verifying in Foundry

None of this is covered by the unit tests, and **most of it has not been confirmed in play yet**.
That is what the `0.x` means: the rules are unit-tested against stub tokens and the maths is
ported from the system's own measurement, but the path from a real PF2e actor to the overlay has
only been walked for some of it.

| Check | Confirmed in play |
| --- | --- |
| Two allies either side of an enemy - enemy outlined, line between the pair | yes |
| Drag one of them away - the outline drops *while dragging*, before you release | yes |
| Move a flanked token away - the outline leaves its old square with it | yes, 0.2.0 |
| Stand between two enemies - your token outlined red | no |
| Flanking positions with an ally next to an enemy - dots opposite the ally | no |
| A reach weapon or Lunge - the reachable ring grows | no |
| A creature two diagonal squares away with 10-foot reach - still in range | no |
| A flyer overhead - not flanked by two melee on the ground | no |
| A GM-hidden token - flanks for nobody, and players never see it outlined | no |
| A hex or gridless scene - one warning, no overlay, other scenes unaffected | no |

The unconfirmed rows are the ones that changed most in 0.2.0 (reach measurement, elevation,
visibility, the grid bail). If one of them is wrong, it is wrong in the direction of showing a
flank the system would not grant, or hiding one it would - not in the direction of breaking the
canvas. Report anything that looks off and include `CONFIG.pf2eFlankVision.debug = true` output.

## Credits

Inspired by [avenzi/foundry_pf2e_flank_helper](https://github.com/avenzi/foundry_pf2e_flank_helper),
which showed that flanking positions are worth drawing on the canvas at all, and settled a
few questions along the way: measure from occupied grid squares rather than token centres,
walk the squares around the enemy rather than the whole scene, and keep the whole thing a
client-side overlay. This module is a fresh implementation for Foundry v14 - no code taken.

Flanking rules and the actor data behind them come from the
[PF2e system](https://github.com/foundryvtt/pf2e).

## License

MIT.
