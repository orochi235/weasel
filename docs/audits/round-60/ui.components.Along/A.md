Note: the frozen commit `deaf03bd8ed407174fa289a1262d2699ffbe97db` isn't in this checkout. HEAD is `6f634fabe1`, and this area has uncommitted changes, so I read every file as it stands on disk in this worktree. I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document follows.

## CurvedLabel shows Latin text backwards under `dir="rtl"` when no bidi engine is registered
- where: packages/ui/src/components/Along/CurvedLabel.tsx:38 (CurvedLabel)
- scenario: `<div dir="rtl"><Along shape={line}><CurvedLabel text="abc" /></Along></div>` with no `registerBidi` call. When there's no engine, `visualGraphemes` returns the graphemes in logical order and skips the `rtl` reversal that the engine path applies (packages/text/src/visualGraphemes.ts:26-28 vs :40). CurvedLabel then lays them on `trackRun(shape, 0, 1, { direction: 'rtl' })`, which starts at the right end. So 'a' lands rightmost and the reader sees "cba". With an engine registered, the same label reads "abc" (CurvedLabel.test.tsx:36). The doc says that without an engine "mixed-direction text keeps its logical order", but here even Latin text in one direction is mirrored. `warnRtlWithoutEngine` stays silent because the text has no RTL code points.
- evidence: read
- severity: medium

## useRunScroll keeps an offset past the new end after its row shrinks, so a focus scroll lands off by the difference and the old offset comes back later
- where: packages/ui/src/components/Along/useRunScroll.ts:155 (onFocusCapture), also :52-54 and :79-80
- scenario: a row is scrolled to its end (offset 200, max 200). Then it loses an item or narrows, and max becomes 120. `shown`, `moved` and `drawn` all stay at 200; only the drawn `offset` is clamped to 120.
  - Tab to an item: `center = spot.center + drawn.current - now()` adds 200 − 120 = 80 px to a spot already laid at offset 120. The run scrolls by the wrong amount, or not at all.
  - A glide then starts from 200 and sits at max for several frames before it moves.
  - If max grows back past 120, the offset jumps back toward 200 with no input.
- evidence: read
- severity: low

## useItemLengths' ResizeObserver keeps every item element it has seen until the key list changes
- where: packages/ui/src/components/Along/useItemLengths.ts:28 (read)
- scenario: every commit, `read` calls `observer.observe(child)` on each current item, but nothing ever calls `unobserve` for an item that has left the DOM. The observer is only replaced when the `keys` signature changes. A bar's More button "comes and goes with what fits, which no key says" (comment at :49), and each remount is a new element. Resizing the window back and forth across the fit point therefore piles up detached buttons that the observer keeps alive, with no limit, for as long as the keys stay the same.
- evidence: read
- severity: low

## LensRim lab crashes on mount when its saved marks are not an array
- where: packages/ui/src/components/Along/lab/LensRimView.tsx:61 (LensRimView)
- scenario: `readLocal(SAVED)` is cast to `Point[]` with no check.
  - An object such as `{}` throws `slice is not a function` in the state initializer, and the story won't render until storage is cleared.
  - A string gets sliced into characters, which render as marks at `undefinedpx`.
  - Entries without finite `x`/`y` render at NaN.

  The TrackGeometry lab next to it checks what it reads (TrackGeometryView.tsx:47).
- evidence: read
- severity: low

## TrackGeometry lab accepts saved handles whose y is not a number
- where: packages/ui/src/components/Along/lab/TrackGeometryView.tsx:47 (initialHandles)
- scenario: the check is `saved[id] && Number.isFinite(saved[id].x)` and never looks at `y`. A saved `{ x: 10 }` or `{ x: 10, y: null }` passes, so the handle's y becomes NaN and the radius and bearings come out NaN. The readouts then show "—" and the track draws nothing until a preset is loaded.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Along/Along.module.css
packages/ui/src/components/Along/Along.stories.module.css
packages/ui/src/components/Along/Along.stories.tsx
packages/ui/src/components/Along/Along.tsx
packages/ui/src/components/Along/CurvedLabel.module.css
packages/ui/src/components/Along/CurvedLabel.stories.module.css
packages/ui/src/components/Along/CurvedLabel.stories.tsx
packages/ui/src/components/Along/CurvedLabel.tsx
packages/ui/src/components/Along/alongContext.ts
packages/ui/src/components/Along/arcInBox.ts
packages/ui/src/components/Along/boxPoint.ts
packages/ui/src/components/Along/index.ts
packages/ui/src/components/Along/lab/ClockSweep.stories.module.css
packages/ui/src/components/Along/lab/ClockSweep.stories.tsx
packages/ui/src/components/Along/lab/ClockSweepView.tsx
packages/ui/src/components/Along/lab/CurvedLabel.stories.module.css
packages/ui/src/components/Along/lab/CurvedLabel.stories.tsx
packages/ui/src/components/Along/lab/CurvedLabelView.tsx
packages/ui/src/components/Along/lab/InputTrace.stories.module.css
packages/ui/src/components/Along/lab/InputTrace.stories.tsx
packages/ui/src/components/Along/lab/InputTraceView.tsx
packages/ui/src/components/Along/lab/LensRim.stories.module.css
packages/ui/src/components/Along/lab/LensRim.stories.tsx
packages/ui/src/components/Along/lab/LensRimView.tsx
packages/ui/src/components/Along/lab/Presets.tsx
packages/ui/src/components/Along/lab/Readouts.tsx
packages/ui/src/components/Along/lab/TrackGeometry.stories.tsx
packages/ui/src/components/Along/lab/TrackGeometryView.tsx
packages/ui/src/components/Along/lab/lab.stories.module.css
packages/ui/src/components/Along/lab/labActions.tsx
packages/ui/src/components/Along/lab/lensImage.ts
packages/ui/src/components/Along/lab/trackDraw.ts
packages/ui/src/components/Along/lab/trackGeometry.ts
packages/ui/src/components/Along/lab/useEventLog.ts
packages/ui/src/components/Along/onRun.module.css
packages/ui/src/components/Along/placeOnRun.ts
packages/ui/src/components/Along/rowRun.ts
packages/ui/src/components/Along/runBend.ts
packages/ui/src/components/Along/runRow.module.css
packages/ui/src/components/Along/runSlots.ts
packages/ui/src/components/Along/runText.module.css
packages/ui/src/components/Along/runText.ts
packages/ui/src/components/Along/useBoxShape.ts
packages/ui/src/components/Along/useItemLengths.ts
packages/ui/src/components/Along/useRowRun.ts
packages/ui/src/components/Along/useRunRow.tsx
packages/ui/src/components/Along/useRunScroll.ts

<!-- done: 5 findings, files read: 47 -->