# Foundry v14 canvas notes

What this module learned the hard way about reading token positions on v14. All of it was found
live in Foundry, none of it is reachable from a unit test, and most of it is not in
`@dfreds/foundry-types`.

## A token's position is not settled while it moves

Foundry v14 interpolates `document.x` and `document.y` through a move animation. They are not the
start, and not the destination, but wherever the token is on this frame:

```
render { doc: '4050,1663.23' }   // 13 px into a 600 px slide
```

Floor that to a grid square and you get the square the token came from. Every draw scheduled by a
drop lands in this window, because `updateToken` and `moveToken` both fire at the *start* of the
animation.

`TokenDocument#movement.destination` is the settled position and is correct from the first frame.
It is a `TokenPosition`, so it carries `x`, `y`, `elevation`, `width` and `height` - everything a
footprint needs. Elevation animates the same way, so take it from there too.

## `movement.state` cannot tell you whether a token is moving

The obvious guard is wrong:

```ts
// WRONG - fires never
const to = doc.movement?.state === "pending" ? doc.movement.destination : null;
```

`state` reads `"completed"` for the entire animation. The states are
`"completed" | "paused" | "pending" | "stopped"`, and a normal drag-and-drop never passes through
`"pending"` anywhere the module can observe. Only `destination` distinguishes a moving token from
a still one, and at rest it equals the document anyway.

## A drag clone is the mirror image

While a token is being dragged, `canvas.tokens.preview.children` holds a clone. On that clone the
relationship inverts:

| | `document.x/y` | `movement.destination` |
| --- | --- | --- |
| placed token, mid-animation | interpolated, wrong | correct |
| drag clone | follows the cursor, correct | the real token's *previous* move, wrong |

So the object decides which source wins, not the movement. `src/scene.ts` reads
`token.isPreview ? document : movement.destination ?? document`. Trusting `destination`
unconditionally pins the drag preview to wherever the token last went.

## `getOccupiedGridSpaceOffsets()` is not in the type definitions

It exists at runtime and it is tempting, but it does not appear anywhere in
`@dfreds/foundry-types` v14.366.1. This module declared it by hand for a while, on the strength of
an API audit that could confirm the call worked but not what it returned *when*. It lags the
document exactly like `x`/`y` do. Deriving the footprint from the position and the token's width
and height is both simpler and correct.

The wider lesson: an API audit can verify that a call exists and returns the right shape. It
cannot verify timing. Anything read during an animation needs a live check.

## Hook order on a drop

Traced on v14, one drag and release:

```
refreshToken (preview live) x N     <- the drag
updateToken                         <- clone still alive
moveToken                           <- clone still alive
refreshToken (preview empty)        <- clone destroyed, animation starts
refreshToken (preview empty) x ~30  <- the animation
```

Three consequences:

- `updateToken` and `moveToken` both fire while the clone is still in
  `canvas.tokens.preview.children`, so a render they schedule will treat the clone as the token
  and exclude the real one.
- Gating `refreshToken` on a live preview discards the entire animation, including the frame the
  clone disappears. The module lets that one frame through on purpose.
- `refreshToken` fires per frame per token. Listening to it ungated is an O(tokens^2) recompute
  every frame, which is why it is gated at all.

## Coalescing must collapse, not discard

A naive `if (pending) return` throws away every request that arrives while a frame is in flight.
On a drop that is exactly the requests that would have got it right: the first render is armed by
`updateToken` while the clone is alive, and everything after it is dropped. A request during a
pending frame has to buy one more frame.

## Tracing

`CONFIG.pf2eFlankVision.debug = true` prints every render request, frame and draw with the source
hook, the coalescing state, and the position each draw measured from. Four rounds of reasoning
about frame ordering got the above wrong; one trace got it right. Reach for it first.
