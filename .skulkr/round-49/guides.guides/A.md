# Audit round 49 — guides.guides (reviewer findings)

## matchSpacing filters reference gaps against the pre-snap box, so a snap that carries the box into a gap's strip still marks that gap
- where: packages/guides/src/guides/alignment/spacing.ts:226-247 (matchSpacing)
- scenario: `refsX`/`refsY` are computed once with `referenceGaps(bounds, …)` on the input `bounds`. The keep/drop loop and the returned `gapsX`/`gapsY` are then evaluated at `final`, the snapped box, but still against those refs. A y snap (or an x snap) that moves the box a few units so it now pokes into the strip of a measured gap between two siblings leaves that gap in `refs`: `hasGap` still counts it and `equalGaps(final, …)` returns it as an "equal gap" marker, though the box now stands inside it. The function's own doc ("A reference gap the box now stands inside no longer counts … every gap marked is one the box has") promises the reverse. Conversely a gap the original box stood in, but the snapped box clears, is never offered. Should be: refilter the measured gaps against `final` (keep the `MeasuredGap[]` and call `referenceGaps(final, …)` inside the loop and for the returned gaps).
- evidence: read
- severity: low

## Add and replace guide ops that change nothing still record an undo step
- where: packages/guides/src/guides/ops.ts:24-27 (createAddGuideOp apply), packages/guides/src/guides/ops.ts:42-46 (createReplaceGuideOp apply)
- scenario: `createRemoveGuideOp` returns `'noop'` when the store holds no such guide, so the recorder (`packages/core/src/core/scene/recorder.ts:204`) records nothing. The add and replace ops answer the same question the other way: re-adding a guide equal to the one held (`useGuides.addGuide` changes nothing via `sameGuide`), or a replace whose `to` equals the held guide, returns `undefined`, so the history gets a "Add Guide"/"Move Guide" step whose undo and redo do nothing. The ruler action guards this itself (`rulers/actions.ts:84`, `to.offset === moving.offset ? null`), but any other caller of the exported ops gets empty steps. Should be: compare the held guide with the new one and return `'noop'` when equal, as the remove op does.
- evidence: read
- severity: low

## Equal-spacing EPS of 1e-6 is absolute, so far from the origin rounding in `x + width` reads touching boxes as overlapping or gapped
- where: packages/guides/src/guides/alignment/spacing.ts:7, 11, 20-22, 63 (EPS, hi, overlap, measureGapSpans)
- scenario: `hi` is computed as `b.x + b.width`; at coordinates around 1e10 the spacing of doubles is ~1.9e-6, larger than `EPS`. Two boxes that touch on the cross axis (one's bottom equals the other's top, computed from different `y`/`height` pairs) can come out with `max - min` of ~2e-6 > EPS and be treated as sharing a cross range, producing a gap (and an equal-spacing snap/marker) between boxes that are only diagonal neighbors; likewise a box touching its neighbor on the axis can be skipped or counted depending on rounding. `derive.ts` uses 1e-3 and `equalGaps` uses 1e-3, so the three tolerances also disagree. Should be: a tolerance relative to the coordinates' magnitude (or a single shared one).
- evidence: read
- severity: low

## Files read
packages/guides/src/guides/alignment/derive.ts
packages/guides/src/guides/alignment/finite.ts
packages/guides/src/guides/alignment/index.ts
packages/guides/src/guides/alignment/match.ts
packages/guides/src/guides/alignment/sceneBounds.ts
packages/guides/src/guides/alignment/spacing.ts
packages/guides/src/guides/alignment/types.ts
packages/guides/src/guides/index.ts
packages/guides/src/guides/layer.ts
packages/guides/src/guides/ops.ts
packages/guides/src/guides/types.ts
packages/guides/src/guides/useGuides.ts

<!-- done: 3 findings, files read: 12 -->
