# Audit round 68 — ui.components.Segmented

## A lone segment in a vertical flat bar loses its top corners' rounding
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:396-402 (`.variant_flat[data-orientation='vertical'] .segment:first-of-type` / `:last-of-type`)
- scenario: `<SegmentedBar variant="flat" orientation="vertical" items={[one]} />`. The only segment matches both rules, which have equal specificity (0,4,0) and both use the `border-radius` shorthand, so the later `:last-of-type` rule (`0 0 r r`) wins over `r r 0 0`: the cell is square on top, round on the bottom. The horizontal flat rules set corner longhands, so a lone horizontal cell gets all four corners, and the default vertical variant has its own `:only-of-type` rule (line 387); the vertical flat variant has none.
- evidence: read
- severity: low

## On a curved run, a flat bar's segments after the first are shifted 1px by the straight row's shared-border margin
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:280 (`.variant_flat:not(.tiled) .segment ~ .segment`), against packages/ui/src/components/Segmented/segmentsAlong.module.css:36-39
- scenario: `<Along arc={…}><SegmentedBar variant="flat" … /></Along>`. `SegmentsAlong` puts `seg.variant_flat` on its root, so `margin-inline-start: -1px` (specificity 0,4,0) applies to every segment but the first; segmentsAlong's `.root[data-variant='flat'] > [data-segment] { margin: 0 }` is only 0,3,0 and loses. Each absolutely placed segment then sits 1px back along its inline axis from the spot `useRunRow` placed it at, although the curved flat row spaces its segments apart with `column-gap` and has no shared rules to overlap.
- evidence: read (specificity computed from the selectors; not rendered)
- severity: low

## Several SegmentedBar stories render a radiogroup with no accessible name
- where: packages/ui/src/components/Segmented/SegmentedBar.stories.tsx:213, 234, 242, 250 (`Disabled`, `Tall`, `Minimal`, `AllowDeselect`)
- scenario: these stories pass `aria-label={ariaLabel}` from `args`, but their `args` set no `'aria-label'` (unlike `Single`, `Multiple`, `Sweep`), and the meta has no default args, so each renders `role="radiogroup"` with no name and no surrounding `Field`. The component's own docs say a bar needs `aria-label`, `aria-labelledby` or a `Field`; the stories, as reference usage and as a11y-scan targets, show an unnamed group.
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
