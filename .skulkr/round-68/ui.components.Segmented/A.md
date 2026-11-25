# Audit round 68 — ui.components.Segmented

## A flat SegmentedBar on a curved `Along` keeps the straight row's -1px seam overlap on every segment after the first
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:280 (`.variant_flat:not(.tiled) .segment ~ .segment`), against packages/ui/src/components/Segmented/segmentsAlong.module.css:36 (`.root[data-variant='flat'] > [data-segment] { margin: 0 }`)
- scenario: `<Along arc={…}><SegmentedBar variant="flat" items={[a,b,c]} … /></Along>`. `SegmentsAlong` adds `seg.variant_flat` to its root (segmentsAlong.tsx:56) and never `.tiled`, so the straight row's rule `margin-inline-start: -1px` matches segments 2..n. The curved stylesheet's `margin: 0` is supposed to cancel it, but it has specificity 0,3,0 against the straight rule's 0,4,0 (`.variant_flat`, `:not(.tiled)`, `.segment`, `.segment`), so it loses. Every absolutely placed segment after the first therefore moves 1px toward physical inline-start, in the parent's unrotated frame. `useRunRow` placed it from its measured length, which doesn't count the margin. So the gap between the first two cells comes out 1px narrower than the others, and on a side arc each cell shifts 1px off the curve. With no shared rule to overlap, that margin should be 0.
- evidence: read
- severity: low

## Several SegmentedBar stories render a radiogroup with no accessible name
- where: packages/ui/src/components/Segmented/SegmentedBar.stories.tsx:213 (Disabled), :234 (Tall), :242 (Minimal), :250 (AllowDeselect), :76 (FromASweep has a label; the others don't)
- scenario: `Disabled`, `Tall`, `Minimal` and `AllowDeselect` pass `aria-label={ariaLabel}` from `args`, but none of their `args` sets `'aria-label'` and neither does the file's `meta`. No `Field` surrounds them either, so `useFieldControl` has nothing to fall back on. Each one renders `role="radiogroup"` with no name, which is an ARIA violation (a radiogroup needs a name). These stories are the component's reference examples, and here they teach leaving the bar unnamed. `Single` and `Boolean2Segment` set the label in `args`; these four should do the same.
- evidence: read
- severity: low

## A canceled sweep's document listeners outlive the bar that installed them
- where: packages/ui/src/components/Segmented/segmentSweep.tsx:55-70 (useSweepGuard `swept('cancel')`)
- scenario: Press and drag across the segments, then press Escape so the sweep cancels while the pointer is still down. Now unmount the bar before releasing, for example because Escape also closes the panel it sits in. The four capture listeners on `document` (pointerup, pointercancel, pointerdown, keydown) have no teardown tied to the component, and they stay until the next pointer or key event on the page. That event is then intercepted by a dead bar's guard, which writes `just.current` on a ref nothing reads anymore. The leak is bounded, since one event removes them, but nothing on unmount clears them. Each further cancel-without-release stacks another set of four.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Segmented/SegmentedBar.stories.tsx
packages/ui/src/components/Segmented/SegmentedBar.tsx
packages/ui/src/components/Segmented/index.ts
packages/ui/src/components/Segmented/lab/SegmentsArc.stories.module.css
packages/ui/src/components/Segmented/lab/SegmentsArc.stories.tsx
packages/ui/src/components/Segmented/lab/SegmentsArcView.tsx
packages/ui/src/components/Segmented/segmentSweep.tsx
packages/ui/src/components/Segmented/segmentedControl.module.css
packages/ui/src/components/Segmented/segmentedRow.tsx
packages/ui/src/components/Segmented/segmentedVariant.ts
packages/ui/src/components/Segmented/segmentsAlong.module.css
packages/ui/src/components/Segmented/segmentsAlong.tsx

<!-- done: 3 findings, files read: 12 -->
