# Output-grid clamping — design

**Status: designed 2026-11-03, not built.** The second of three arcs: dithering
(`@weasel-js/dither`, built), this, then multiple render targets (`docs/TODO.md`, "Multiple
render targets"). It uses the `OutputGrid` type the dither arc added to `@weasel-js/geom`.

For whoever builds it in core. It answers how a scene keeps a node's geometry on the dot grid of an
output target (a printer, a 1-bit panel), on every path that writes geometry, and how a node can be
drawn on that grid without its stored pose changing.

The model is lbx-editor's `src/dotSnap.ts`, read at `09d2998`. lbx resizes a barcode so each module
is a whole number of printer dots (`snapNodePose`), and draws it on the dot grid (`gridAligned`).
It calls `snapNodePose` from seven places (the resize constraint, the insert factory, file import,
typed W/H, arrange's match size, a payload edit, and stroke width), because nothing in weasel runs
on every write. That is the gap this arc fills.

## Decisions

- **Both stored and drawn, declared per field (2026-11-03).** Whether a value belongs in the
  document depends on whether it must hold after the grid changes. lbx stores a barcode's size (so
  W/H show the real size) and only draws its position on the grid (because the band origin moves
  with tape width).
- **The stored rule covers node data as well as poses (2026-11-03).** A stroke 1.5 dots wide prints
  as ragged as a barcode module does, and its width is in data, written by a property panel.
- **The grid is a document value (2026-11-03),** so changing it is an undoable edit and the stored
  fields re-snap inside that same edit. Nothing in the document can hold values snapped to a grid it
  no longer has.

## The grid

`scene.doc` key `kit:outputGrid`, holding an `OutputGrid`: `{ pitch, origin: { x, y } }` in
document units, one dot's size and where dot (0, 0)'s corner sits. Absent, nothing quantizes.
A P-touch label's is `{ pitch: 72 / dpi, origin: { x: 0, y: printableBand(tape, media).y } }`, with
`printableBand` from `@weasel-js/p-touch` (branch `p-touch`, unmerged on 2026-11-03), which owns that
math; don't copy it here.

`OutputGrid` is a 2D raster, the target's dots, so a kernel3d scene does not set one; that is a
stated choice. The rule below is generic over the pose type, so nothing outside the rect helpers
assumes `{x, y}`.

## The rule

A scene option. One function pair the consumer writes, switching on node kind itself:

```ts
interface QuantizeRule<TData, TPose> {
  /** The values the document holds on the grid, or null when nothing changes. */
  stored?(
    node: { data: TData; pose: TPose },
    grid: OutputGrid,
    anchor?: ResizeAnchor,
  ): { pose?: TPose; data?: TData } | null;
  /** Where the node is drawn. The document keeps the exact pose. */
  drawn?(node: { data: TData; pose: TPose }, grid: OutputGrid): TPose;
}
```

`anchor` is the side a resize holds, `ResizeAnchor` from `@weasel-js/routing`; absent, the top-left
holds.

`stored` must be idempotent: run on its own output it returns null. Otherwise the pass below writes
on every edit. In development the pass runs `stored` a second time on what it wrote and warns when
that changes anything.

## Where each half runs

| Path | Mechanism |
|---|---|
| Every committed write: a direct scene call, ops (a gesture's release, align, nudge), paste, import, layout | A kit edit pass (`scene.addEditPass`, `packages/core/src/core/scene/editPass.ts`) ordered after every other, running `stored` over the summary's `added`, `posed` and `dataChanged` nodes. Its ops join the edit's undo entry. Undo and redo never run passes, which is right: they restore values already quantized. |
| The grid changing | The same pass, hearing `kit:outputGrid` in `docChanged`, runs `stored` over every node. One undo reverts the grid and the re-snap together. |
| A gesture's live preview (resize, insert, move) | Previews are pose overrides, not scene writes (`scene.overrides`), so the pass hears them only at release. The actions run `stored` on the preview pose, after the `snap` dep, since the grid is the invariant. Resize does this as a kit-supplied `BoundsConstraint`, the hook lbx uses today, passing the drag's anchor. |
| Rendering | The scene layer hands `drawn`'s pose to `drawOne`. Hit-testing, selection handles and every other reader keep the exact pose; they differ by under half a dot. |

## Rect helpers

Exported beside the rule, for the common `RectPose`, and replacing lbx's copies:

| Helper | Replaces |
|---|---|
| `snapToPitch(value, pitch)`: a whole number of dots, never below one | `snapToDots` |
| `quantizeSize(pose, width, height, anchor)`: resized with `anchor`'s sides held | `resized` |
| `alignToGrid(pose, grid)`: the nearest grid corner, size untouched | `gridAligned` |

lbx's rule is then its barcode module math (whole dots per module, from the encoded symbol) over
these, a stroke-width snap in `stored`, and `alignToGrid` for barcodes in `drawn`.

## Tests

- The pass quantizes a `setPose`, a data edit (stroke width), an insert and an import, and leaves a
  node the rule returns null for untouched.
- Setting the grid re-snaps every node; one undo restores both the old grid and the old values.
- Clearing the grid stops quantization, and changes no stored value.
- A live resize from each handle snaps with the opposite side held, and the release commits the same
  pose the preview showed.
- `drawn` moves what is drawn and not what is hit.
- A rule that is not idempotent warns in development.
- The helpers: rounding at half a dot, the one-dot floor, and a grid origin off zero.

## Not in this arc

- lbx-editor adopting it: lbx consumes weasel from npm, so that is lbx's change after a release.
- Snapping rotation or skew to the grid: no rule needs it, and `stored` can already do it for a
  consumer that wants it.
