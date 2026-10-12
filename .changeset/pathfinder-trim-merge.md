---
'@weasel-js/core': patch
---

Trim and Merge are Boolean operations. Trim cuts each selected shape back to the part of it left showing under the shapes in front; Merge does the same, then unites the pieces whose sources wear the same fill. New API: `'trim'` and `'merge'` in `BooleanOp`, `trim()` and `merge()` on `useBooleans`, the `pathfinder.trim` and `pathfinder.merge` actions (`pathfinderTrimAction`, `pathfinderMergeAction`, registered with the `paths` feature and shown in the `pathfinder` action group), and `TrimIcon` and `MergeIcon`.

Each result is minted from its own source, as a Divide's pieces are. Merge compares fills as `BooleansAdapter.getPaint` reports them, or the stroke's paint for an operand whose stroke was counted in; an operand the adapter reports no paint for is united with nothing, so Merge on an adapter without `getPaint` is a Trim. Strokes are otherwise left as the adapter paints them: unlike Illustrator's, this Trim does not strip them.

A `Record<BooleanOp, …>` in consumer code needs the two new keys. The two glyphs were drawn on an agent's judgment.
