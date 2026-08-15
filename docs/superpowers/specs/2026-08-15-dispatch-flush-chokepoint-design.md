# Making the solid-batch flush structural — design

**Date:** 2026-08-15
**Status:** implemented 2026-08-15

What this is: how the renderer stops requiring every draw path to remember
`flushSolids`. For anyone touching `renderer/draw.ts`'s dispatch or the solid
batch. It answers where the flush should live and what it deliberately is not.

## The problem

`dispatch` walks the command tree emitting GL inline, except for solid geometry,
which defers into `SolidBatch`. So anything that draws by another route must
drain the batch first or its pixels land on top of geometry that was staged
before it — painter's order, silently wrong. Six sites call `flushSolids` today,
and forgetting a seventh would not throw, drop pixels, or fail a type check. Only
a visual diff or one of `solidBatch.test.ts`'s 18 boundary tests would catch it.

The worse half is that the requirement is invisible where it matters. A new
emitter's author has no signal that the obligation exists; it lives in prose in a
handoff and in the memory of whoever wrote the last one.

## Design

Move every flush to a site that *decides routing* or *changes stencil state*, and
leave none inside an emitter.

### `tryStageSolid(ctx, mesh, paint): boolean`

The chokepoint. Returns `true` when the mesh was staged into the batch, meaning
the caller is done. Returns `false` **having already flushed**, meaning the caller
may emit its own draw.

`drawPath`'s fill and `drawPathStrokeUnclipped` — the two paths that run per
command — both take this route:

```ts
if (tryStageSolid(ctx, mesh, solid)) return;
const handle = meshHandle(ctx, mesh);
// … own draw
```

The value is not the saved line. It is that the only way to earn permission to
draw directly is to have called the function that flushed, so a forgotten flush
becomes unexpressible rather than merely unlikely. The `false implies flushed`
invariant lives in one function and gets one test.

`drawPath`'s rect fast path keeps calling `pushRect` and never draws directly, so
it is unchanged. `pushRect` and `pushMesh` keep their own state-change and
overflow flushes — those are the batch managing its own staging, not a caller
remembering something.

### `pushClip` and `popClip` flush themselves

Rasterizing into the stencil is what creates the obligation: a run staged outside
a clip would draw under a mask it never had, and one that outlives `popClip`
paints pixels that belonged inside a mask that is gone. That is intrinsic to the
operation, not something a caller happens to know, so `drawGroup` should not be
the one to know it. Both functions flush as their first statement, and
`drawGroup`'s two "Before, not after" comments move into them.

Both are exported and unit-tested standalone in `draw.test.ts`; flushing an empty
batch is a no-op, so those tests are unaffected.

### Two sites stay, both already structural

`dispatch`'s `text` / `image` / `shader` cases flush in the switch rather than
inside `drawText`, which is already the right place — the routing decision and the
flush are the same line.

`drawPathStroke` flushes at its branch point when an inner/outer-aligned polygon
sends it to the stencilled path, which cannot batch. The flush moves to sit with
that decision rather than inside `drawPathStrokeStenciled`.

Six scattered calls become three, all at decision points.

## Testing

`solidBatch.test.ts`'s 18 flush-boundary tests are the regression net and must
stay green **untouched**. If any needs editing, the refactor changed behavior and
that is the finding.

New:

- `tryStageSolid` returns `false` only after flushing, and `true` without one —
  asserted against the GL recorder, not by inspection.
- `pushClip` and `popClip` each drain a staged batch before their first stencil
  call, asserted by call order in the recorder.

`npm run test:visual`'s 35 baselines are the end-to-end gate; ordering regressions
are pixels.

## Out of scope

No materialized item list, no lookahead, no op reordering. The full two-phase
split — walk into a flat list of draw items with resolved state, then group and
emit — is what step 4 of `docs/handoffs/2026-08-14-batched-dispatch.md` (one
program plus atlases) wants, and this does not pretend to be it. It makes that
easier to reach by hoisting the routing decision out of the emitters, which is
the part a planning phase would need either way.
