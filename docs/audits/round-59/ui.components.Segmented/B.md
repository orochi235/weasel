# Audit round 59 — ui.components.Segmented

## A mixed segment draws as off in the `flat` variant
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:268 (`.variant_flat .segment`) against :176 (`.segmentMixed`)
- scenario: `<SegmentedBar mode="multiple" variant="flat" mixedValues={['b']} …/>` (a property panel over a mixed selection, the surface `flat` exists for). The `b` button wears `segmentMixed` and `aria-pressed="mixed"`, but `.variant_flat .segment` (0,2,0) sets `background: var(--wzl-surface-sunken)`, `box-shadow` and `color` over `.segmentMixed` (0,1,0), and no `.variant_flat .segmentMixed` rule exists (minimal has one, :186). The segment looks identical to an off one until hovered, when `.segmentMixed:hover:not(…)` (0,3,0) finally wins. Should draw the mixed wash at rest, as default and minimal do. Same in a curved `Along` with `variant="flat"`, which keeps the state classes (`drawsState` false).
- evidence: read
- severity: medium

## Escape mid-sweep, then a release on the pressed segment, toggles it after the revert
- where: packages/ui/src/components/Segmented/segmentSweep.tsx:44 (`useSweepGuard`), :80 (`end`); packages/ui/src/components/Segmented/SegmentedBar.tsx:161 (`press`)
- scenario: `mode="multiple" sweep`, value `[]`. Press on segment A, drag past the threshold (the sweep's `enter(first)` turns A on), press Escape while the button is still held: the pointer session cancels, `end('cancel')` reverts A to off and calls `swept()`, whose `setTimeout(…, 0)` clears the guard in the next task. The session releases its pointer capture at teardown, so releasing over A (seconds later) makes the browser fire `click` on A; `guard.sweeping()` is long false, and `press` turns A on. The user canceled and the value changed anyway. The guard should cover the press's own click whenever it comes (clear it on the next `pointerdown`, or swallow the next click from that pointer), not for one task after the sweep ends. The tests cover only `pointercancel`, which makes no click.
- evidence: read (pointerSession.ts releases capture at teardown, :130, and handles Escape from `document`, :166); the click firing on A after release is inference from pointer-event rules, not run
- severity: medium

## Turning `sweep` on or off remounts the whole bar
- where: packages/ui/src/components/Segmented/SegmentedBar.tsx:208 (`SegmentedBar` return)
- scenario: a consumer that sweeps per mode or per setting (`sweep={editable}`, or `mode` switching between `'single'` and `'multiple'` with `sweep` set). Without a sweep the bar returns `holdScope(props, row)` (a `Disabled` element); with one it returns a Fragment of `[holdScope(...), <SegmentSweeper/>]`. The root element type changes, so React unmounts every segment button and remounts them: the focused segment loses focus, tooltips and FitScope state reset. `holdScope` itself is written to never remount on a toggle ("Both scopes always, so turning one on or off does not remount what is inside"); this return defeats that. Should keep one shape, e.g. always the Fragment with the sweeper rendered conditionally inside it.
- evidence: read
- severity: low

## A sweep stops working when the row's root element is replaced
- where: packages/ui/src/components/Segmented/segmentSweep.tsx:88 (`Dispatch`, `useGestureDispatcher({ canvasRef: props.rootRef })`); root swap in packages/ui/src/components/Segmented/segmentedRow.tsx:92
- scenario: a swept bar inside an `Along` whose shape changes kind at runtime (an arc becoming a line, or the bar moving into/out of a curved run): `SegmentedRow` switches between its own `<div>` and `SegmentsAlong`'s `<div>`, so `roving.rootRef` points at a new element. `useGestureDispatcher` attaches in an effect to `canvasRef.current` with the ref object as its only identity dep (useGestureDispatcher.tsx:137-168), so it never re-attaches; the sweep's listeners stay on the detached old div and drags no longer sweep (clicks still toggle). Should re-key the sweeper on the root element, or have the row hand its element through state.
- evidence: read
- severity: low

## The curved well's end cap stays unlit when the bar mounts with no segments
- where: packages/ui/src/components/Segmented/segmentsAlong.tsx:117 (`useWellEnds`)
- scenario: a default-variant `SegmentedBar` in a curved `Along` whose items arrive after mount (loading, or `count` starting at 0). The layout effect runs once (`[root]`), finds no `[data-segment]`, sets `cap` to 0 and watches only `[el, null]`. When segments appear, nothing re-queries; the root on a run is sized by its track, so its observer need not fire. A lit end segment's stroke then stops at `outer.hi + 0` instead of running under the rim's round cap, leaving the cap's curve unlit. The same staleness holds when the first segment is replaced (new items): the observer watches a detached element. Should re-query the first segment when the segment list changes.
- evidence: read
- severity: low

## The arc lab's each-mode bar ignores every press, and its top bar keeps a value that is not among its items
- where: packages/ui/src/components/Segmented/lab/SegmentsArcView.tsx:55, :28
- scenario: the "Snap" bar's items have `selected` constants and `onChange: () => {}`, so clicking Grid or Guides does nothing, in a lab that exists to show each mode working on an arc (and a sweep or toggle there cannot be checked). Separately, `tool` is seeded once from `words[1]`; drag "Top bar segments" to 1 and the value stays `'Scale'`, which no item has, so the single bar shows nothing on and its radiogroup has no tab stop until clicked. Should hold the each-mode state in `useState` as `ModeBar` in SegmentedBar.stories.tsx does, and fall back when `tool` leaves `words`.
- evidence: read
- severity: low

## A wrapped `flat` bar pulls every row after the first 1px left of the grid
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:280 (`.variant_flat .segment ~ .segment`)
- scenario: `<SegmentedBar variant="flat" columns={4} items={days} …/>`. The rule that makes adjacent cells share a border gives every segment after the first `margin-inline-start: -1px`, including the first cell of rows 2 and on, which has no neighbor to its start in a grid. Those cells sit 1px left of row 1's first cell, poking past the well's edge, and rows share no rule vertically (no block-start overlap), so horizontal borders double. Should be scoped off `.root.tiled`, which lays cells by grid columns rather than inline flow.
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

<!-- done: 7 findings, files read: 12 -->
