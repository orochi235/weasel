# Audit round 59 — ui.components.Segmented

## A curved well's end cap is measured from the first segment found at mount, never re-queried, so a bar whose segments arrive later keeps `cap = 0`
- where: packages/ui/src/components/Segmented/segmentsAlong.tsx:117 (useWellEnds)
- scenario: `useWellEnds` runs its layout effect only on `[root]`, and finds `segment` with one `querySelector` there. A default-variant `SegmentedBar` inside a curved `Along` that first renders with `items={[]}` (data still loading) and then gets items: `segment` was `null`, `measure` keeps setting `cap` to `segment?.offsetHeight ?? 0`, and the root's resize observer re-runs `measure` with the same stale `null`. `cap` stays 0, so `Well`'s `lit()` stops a lit end segment exactly at `outer.lo`/`outer.hi`, and the rim mask's round cap shows unlit past it. The lit end looks cut flat inside the pill end. The same happens when the first segment is replaced (items reordered or filtered so a new key comes first): the observer keeps watching the detached old button. Expected: re-query the first segment when the segment keys change, as `useItemLengths` does with its `signature` dep.
- evidence: read
- severity: medium

## In a tiled bar, the vertical-orientation corner rules override the tile corners, and a bar inherits `vertical` from its enclosing run
- where: packages/ui/src/components/Segmented/segmentedControl.module.css:356 (`.root[data-orientation='vertical']:not(...) .segment:first-of-type` / `:last-of-type`), set by packages/ui/src/components/Segmented/segmentedRow.tsx:101
- scenario: `SegmentedRow` writes `data-orientation={props.orientation ?? enclosing.orientation}` even when it lays out a `tiling` grid. Take `<SegmentedBar columns={4} …>` inside a vertical `RunScope` (a vertical toolbar or panel column), or with `orientation="vertical"`. The vertical rules have specificity 0,4,0 and come after the `.root.tiled .segment[data-tile-corners~=…]` rules, which are also 0,4,0. So the first cell gets `border-radius: pill pill 0 0`, which rounds its top-end corner on an interior seam beside cell 2. The last cell gets `0 0 pill pill`, which rounds its bottom-start corner when the last row is not full. Both drop the tile radius. Expected: a tiled row keeps only its tile corners, whatever the orientation.
- evidence: read
- severity: low

## A `steps` bar silently drops every step past `stepsOf`'s 256-step cap, where `Sequence` says it has capped
- where: packages/ui/src/components/Segmented/SegmentedBar.tsx:100 (itemsOf)
- scenario: `itemsOf` keeps `stepsOf(sweep).steps` and throws away `capped`. Take `<SegmentedBar steps={rangeSweep({ from: 0, to: 1000, step: 1 })} value={500} …/>`, or a `sweepUntil` that never ends. The bar draws 256 segments with no sign it was cut short, and a `value` past the cap (500) shows no segment on, so the control reads as "nothing chosen". `Sequence`, which the doc comment says walks steps "as `Sequence` walks it", shows `Showing the first {cap} steps.` (packages/ui/src/components/Sequence/Sequence.tsx:27). One decision, answered two ways.
- evidence: read
- severity: low

## A sweep canceled with Escape mid-drag still lets the release's click toggle the pressed segment
- where: packages/ui/src/components/Segmented/segmentSweep.tsx:44 (useSweepGuard) and :80 (end)
- scenario: Press segment A in a `sweep` bar, drag onto B (B flips), drag back onto A, and press Escape while the button is still held. `end('cancel')` reverts and calls `swept()`. The guard is true only until a 0 ms timeout, which fires long before the user releases. Releasing over A then makes a click whose press and release are both on A, so `onClick` → `press(A)` toggles A. The user canceled the sweep, and one segment still changed. Expected: the guard covers the click that this pointer's release makes, not one task after the sweep ends; for example, clear it on the next pointerdown or after the release's click.
- evidence: read
- severity: low

## The curved well draws no forced-colors state, though the straight row adds one so that a segment still reads as on
- where: packages/ui/src/components/Segmented/segmentsAlong.module.css:81 (`.lit`, `.mixed`); segmentsAlong.tsx:53 (`drawsState: well`)
- scenario: In a default-variant curved bar the segments wear no `segmentSelected`/`segmentMixed` class (`drawsState`), and the on state is only an SVG stroke of `var(--wzl-accent)` behind the label. segmentedControl.module.css:382 notes that under `forced-colors: active` "no segment would read as on" and gives selected segments `Highlight` and mixed ones a dashed outline. segmentsAlong.module.css has no `@media (forced-colors: active)` block, so a curved bar in Windows High Contrast loses that treatment. Its lit stroke and the label colors it sets become system colors or vanish, and on and mixed segments look like off ones.
- evidence: read
- severity: low

## The lab's each-mode bar has no-op `onChange`s, so it never responds to a press
- where: packages/ui/src/components/Segmented/lab/SegmentsArcView.tsx:55 (SegmentsArcView)
- scenario: The "Snap" `mode="each"` bar's items carry `selected: true/false` constants and `onChange: () => {}`. Clicking Grid or Guides, or Alt-clicking to solo, changes nothing. The other three bars in the view hold live state. A demo is a reference implementation, and this one shows an each bar that cannot be operated. Separately, `tool` is seeded once from `words[1]`, so moving the "Top bar segments" slider to 1 leaves the top bar with nothing selected.
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

<!-- done: 6 findings, files read: 12 -->
