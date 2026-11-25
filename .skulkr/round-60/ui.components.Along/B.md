# Audit round 60 — ui.components.Along (blind reviewer)

Note: commit deaf03bd8ed407174fa289a1262d2699ffbe97db is not in this repo's object store (`git log -1` → bad object), so the
working tree as found was read as the frozen state.

## Focus scroll-into-view goes the wrong way after the run's scroll range shrinks
- where: packages/ui/src/components/Along/useRunScroll.ts:155 (useRunScroll, onFocusCapture)
- scenario: a row scrolled to its end (`moved = drawn = 500`) then gets a smaller `max` (the `Along` box grows, or an item
  is removed) — say `max = 100`. The row is drawn at `clamp(shown, 0, max) = 100`, but `drawn.current` stays 500. Tabbing
  to an item past the start (`spot.center = -50`, run 300 px) computes `center = -50 + drawn(500) - now()(100) = 350`, so
  `hi > along.length` and it calls `scrollTo(now() + …)` forward, which clamps to `max` and is a no-op: the focused item
  stays hidden past the start (opacity 0). The same stale `drawn` makes the next wheel glide start from 500, so the row
  sits visibly still for ~6 frames while the lerp falls back under `max`. Should compare against the drawn offset as
  rendered, `clamp(drawn.current, 0, max)`, or clamp `drawn`/`moved` when `max` shrinks.
- evidence: read
- severity: medium

## CurvedLabel's `offset` does nothing for any label that fits its track
- where: packages/ui/src/components/Along/CurvedLabel.tsx:59 (CurvedLabel)
- scenario: `<Along><CurvedLabel text="Text along a curve" offset={40} /></Along>` on a 280 px box. The prop doc says the
  text is laid back 40 px "from where the `Along`'s `align` puts it", but it is passed to `placeAlongRun` with no `at`,
  and `runPlaces` (packages/geom/src/track/place.ts:38–40) reads `offset` only when the sequence does *not* fit
  (`fits ? align-based lo : -offset`). So for every label shorter than its arc — the normal case — the text sits exactly
  where `offset={0}` would put it; the story's "Offset" slider moves nothing. For a label longer than the arc, `offset`
  instead becomes an absolute lay-back from the start, ignoring `align`. Should pass the align point explicitly
  (`at`: 0 / length / length÷2 by `align`) so `offset` is measured from where `align` puts the text. The browser test
  "align, offset and shift reach placeAlongRun" compares against `placeAlongRun` with the same options, so it passes
  either way.
- evidence: read
- severity: medium

## Bent run text is misplaced under a rotated ancestor whenever the row does not scroll
- where: packages/ui/src/components/Along/runText.ts:35 (useRunText → bendText, `frame?.current ?? el`)
- scenario: `useRunRow` hands `useRunText` its `band` as the frame, but `RunBand` renders that svg only while the row
  scrolls. A row that fits has no band, so `bendText` maps client points through the root, an HTML element, and
  `boxPoint` falls back to `clientToCanvas`, which only subtracts the bounding box's corner and divides out scale
  (packages/routing/src/viewport/clientToCanvas.ts:80). Put the `Along`'s box under `transform: rotate(30deg)` (a turned
  dial or lens): the root's bounding client rect is the rotated box's axis-aligned hull, so every text center and span
  origin is mapped to the wrong run px and the copied glyphs land off their items, while the same row drawn wider (so
  it scrolls and gets the band) lays them correctly. The mapping should not depend on whether the row scrolls: invert
  the root's own screen transform (e.g. through an always-present svg, or `getScreenCTM`-equivalent for HTML).
- evidence: read
- severity: low

## useItemLengths keeps every removed item observed until the key list changes
- where: packages/ui/src/components/Along/useItemLengths.ts:28 (read)
- scenario: each commit's `read` calls `observer.observe(child)` on every keyed item found, but nothing unobserves an
  item that has left the DOM; only a change of `signature` disconnects the observer. The comment at line 48 names the
  case: a bar's More button comes and goes with what fits while `keys` stays the same. Resizing a bar back and forth
  across the fit point mounts a fresh More element each time, and each old one stays in the observer's target list
  (keeping the detached node reachable from the hook's ref) for as long as the bar's keys don't change — unbounded over
  a session. Should unobserve elements no longer returned by `itemsOf`, or rebuild the observation set each read.
- evidence: read (retention of detached targets by a live ResizeObserver is inferred, not measured)
- severity: low

## LensRim lab's saved marks drift off the picture when the Size knob changes
- where: packages/ui/src/components/Along/lab/LensRimView.tsx:50 (pictureAt) and :85 (mark render)
- scenario: a mark is stored in the px of a lens `size` px across (`x + size / 2`), and the picture is drawn at 100% of
  the lens, so a mark's px are only meaningful at the size it was made at. Mark the picture's center at Size 260
  (stored as 130,130), then move Size to 420: the mark is still drawn at 130,130, now well up and left of the center
  it marked, and it is saved that way to localStorage. The view's own doc says a press "marks the spot in its own
  coordinates, so a mark stays put" — it should store marks as a share of the picture (divide by `size`) or in the
  image's 200-unit viewBox.
- evidence: read
- severity: low

## InputTrace's "claimed" flag is never set on a coalesced pointermove line
- where: packages/ui/src/components/Along/lab/useEventLog.ts:71–77 (useEventLog, onEvent)
- scenario: with "Pointer moves" logged, a second pointermove on the same target is folded into the top line, which
  keeps the top line's `id`; the deferred `defaultPrevented` check then looks for the new `line.id`, which is in no
  line, so a move that a control claims with `preventDefault` after the first one never marks the log as claimed.
  Should mark the line the event was actually folded into (the top line's id).
- evidence: read
- severity: low

## A sideways wheel or trackpad swipe scrolls a right-to-left-reading run backwards
- where: packages/ui/src/components/Along/useRunScroll.ts:95–99 (useRunScroll, wheel handler)
- scenario: the handler adds `px.y || px.x` to the offset whatever way the run reads across the screen. On a run that
  reads right to left on screen — a clockwise bottom arc under `ltr`, or any top arc under `dir="rtl"`
  (`screenDirection` returns `'rtl'` for both, rowRun.test.ts:37–39) — a two-finger swipe toward the left (`deltaX > 0`)
  raises the offset, which slides the items toward the run's start, i.e. to the right: the row moves against the
  fingers, while the same swipe on a top arc moves it with them. The arrow keys already go through
  `screenDirection(run)` so they follow the screen (segmentsAlong.tsx:60, BarAlong.tsx:80, SliderBody.tsx:73); the wheel's
  horizontal component answers the same question the other way. Should negate `px.x` when `screenDirection(run)` is `'rtl'`.
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

<!-- done: 7 findings, files read: 47 -->
