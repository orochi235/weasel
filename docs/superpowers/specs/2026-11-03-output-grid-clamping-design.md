# Output-grid clamping — the insert preview

**Status: unbuilt (2026-11-03).** The rest of the output-grid arc is built: the scene's `quantize`
rule (`QuantizeRule` in `packages/core/src/core/scene/useSceneOptions.ts`), the edit pass and the
walk's drawn pose (`packages/core/src/core/scene/outputGrid.ts`), and the resize and move previews.
How to use it is in `packages/dither/README.md`, "Whole-dot marks". `docs/TODO.md` carries this
entry until it lands.

For whoever builds the last piece in core: an insert's live preview does not run the rule's
`stored` half, so under a rule that resizes, the shape a drag shows can land up to a dot off where
the release commits it. The release itself is right; the edit pass snaps the new node.

## Why it is not a one-liner

`stored` takes the node's data, and an insert has no node until the `insert` dep mints one on
release. The dep's `build` answers the node it would insert, but it mints an id and advances the
insert palette's sequence, so it cannot run once per frame.

## What to build

- A side-effect-free read on `InsertDep` answering the `{ data, pose }` that `build` would insert
  for given bounds and extras: the same factory and palette pick `build` makes, with no id minted
  and the sequence not advanced. In `packages/core/src/canvas/deps/insert.ts`, split `build` so both
  share it.
- `insertAction`'s `overlay()` runs `quantizedPreview` over that pose and draws the preview at the
  result. The overlay draws kit shapes from `bounds`, so the quantized pose's box goes in `bounds`;
  a kind whose geometry rides in `extras` (a polygon's center and radius) is rebuilt from that box.
- The pose `build` answers is local to the insert's parent; the overlay draws in world coordinates.

## Tests

- Under a rule that snaps size, an insert's preview at each frame equals the pose its release
  commits.
- Previewing does not advance the palette: two inserts get the colors they get with no preview.
