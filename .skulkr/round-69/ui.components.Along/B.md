# Audit round 69 — ui.components.Along

## useRunText builds its copies from the global document, so a run row rendered into another document throws
- where: packages/ui/src/components/Along/runText.ts:118 (make, sheet), also :47 (fonts), :68 (createRange), :91 (createTreeWalker)
- scenario: a run row (Bar, Tabs, SegmentedBar in an `Along`) is portaled into a second document, such as a popout window or an iframe the app renders into. `make` gives every bend's shadow root the one `CSSStyleSheet` that `sheet()` built in the main window's realm (`new CSSStyleSheet()`), and setting `adoptedStyleSheets` to a constructed sheet from another document throws `NotAllowedError` ("Sharing constructed stylesheets in multiple documents is not allowed"). That throw happens inside a layout effect, so the row's tree unmounts. Even where nothing throws, the `loadingdone` listener sits on the main `document.fonts`, so a web font landing in the row's own document never redraws the copies, and the glyphs stay laid out with the fallback font's metrics. Expected: build the span, range, walker and sheet from `root.ownerDocument` (one sheet per document), and listen on that document's `fonts`. The same file already measures through `measureContextIn(parent.ownerDocument)`, whose doc says a canvas resolves fonts against its own document, so this file answers "which document" two different ways.
- evidence: read (runText.ts; measureContext.ts:3–7 for the per-document convention); the cross-document throw is from the CSSOM spec, not run here
- severity: medium

## A drag that starts mid-glide jumps the run to the glide's target
- where: packages/ui/src/components/Along/useRunScroll.ts:128 (onPointerDownCapture)
- scenario: a wheel tick sends the run, say, 120 px further, so `moved` is the target while `drawn` is still gliding toward it over about 60 ms. A press and drag during that glide takes `from = now()`, which is the target rather than where the items are drawn. The first move past the drag threshold calls `scrollTo(from - travel, 'jump')`, and the items jump by up to the rest of the glide (up to a page, which is `run.length`) before following the pointer. Expected: measure the drag from where the run is drawn (`drawn.current`), as `onFocusCapture` already does on :164 ("the spots are where the run is drawn, which mid-glide lags where it is going").
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

<!-- done: 2 findings, files read: 47 -->
