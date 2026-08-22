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

Foundry VTT v14, PF2e system v8.


## Install

Add-on module manifest URL:

```
https://raw.githubusercontent.com/eturino/pf2e-flank-vision/main/module.json
```

On the media server the module is a git clone, so updates are a pull:

```bash
cd ~/foundry-vtt-data/Data/modules
git clone git@github.com:eturino/pf2e-flank-vision.git   # first time
cd pf2e-flank-vision && git pull                         # updates
```

`dist/` is committed on purpose - the server has no node toolchain, so a pull is enough.

## Settings

All client-scoped, so each player picks their own overlays. `Alt+F` toggles the module
without opening settings.

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

`src/geometry.ts` is pure math and fully unit-tested. `src/flanking.ts` holds the rules,
tested against stub tokens. `src/scene.ts` is the only place that talks to Foundry's
canvas API, `src/draw.ts` the only place that draws.

## Known limits

- Multi-token drags preview only the first token.
- Gang Up is supported in its numeric/always form; the Animal Companion (Side by Side)
  and eidolon variants are not.
- The draw is O(tokens^2) with no caching, recomputed at most once per animation frame.
- Flanking positions ignore terrain cost and difficult terrain - they answer "could I
  flank from there", not "can I get there this turn".

## Verifying in Foundry

Nothing below is covered by the unit tests, so check once after installing:

1. Two allies either side of an enemy - enemy outlined, line between the pair.
2. Drag one of them away - the outline should drop *while dragging*, before you release.
3. Stand between two enemies - your token outlined red.
4. Turn on flanking positions with an ally next to an enemy - dots opposite the ally.
5. Give someone a reach weapon or Lunge - the reachable ring grows.

## License

MIT.



