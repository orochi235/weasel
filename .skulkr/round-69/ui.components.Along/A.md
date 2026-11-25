# Audit round 69 — ui.components.Along

## Run text in a popout or iframe gets the main window's constructed sheet and font set
- where: packages/ui/src/components/Along/runText.ts:117-118 (make), :136 (sheet), :47 (useRunText)
- scenario: a curved Bar/Tabs row rendered into a popout window's document (a supported case: the ui changelog's f76c9ce says text along a curved run "fits in an iframe or a popout window", and `metricsOf` already measures through `measureContextIn(parent.ownerDocument)`). `make` builds the span with the global `document` and assigns `adoptedStyleSheets = [sheet()]`, a `CSSStyleSheet` constructed in the opener's realm; `node.after(span)` then adopts the span and its shadow root into the popout's document, where a constructed sheet from another document is not allowed (the CSSOM rule that throws `NotAllowedError` on assignment and drops such sheets on adoption). The copy's svg loses `position:absolute; 1px; overflow:visible`, its path loses `fill:none` and its text `fill: currentColor`, so each label draws as a black-filled path blob with black text while the real glyphs are transparent. Separately, the `loadingdone` listener is on the global `document.fonts`, so a web font landing in the popout never redraws the copies (the same gap 992b75b fixed for fit scopes). Should create the span/sheet from `node.ownerDocument` (one sheet per document) and listen on `root.ownerDocument.fonts`.
- evidence: read
- severity: medium

## A slot host's `thickness` goes stale when slots change height but not width
- where: packages/ui/src/components/Along/runSlots.ts:126-139, 164-169 (useRunSlotHost / seenUnder)
- scenario: slots re-measure heights only from a commit or a `RUN_SLOT` mutation. When their height alone changes with no commit of the host (a density token or font-size change on an ancestor via CSS, a web font with taller metrics), `useItemLengths`'s ResizeObserver fires but `setLengths` returns `prev` because widths are equal, so the host never re-renders and `seenUnder` never runs: `thickness` keeps the old height and whatever the host sizes from it (the band's thickness across the run) is wrong until some unrelated commit.
- evidence: read
- severity: low

## `useRunGap` misses a `column-gap` change that does not resize the root
- where: packages/ui/src/components/Along/useItemLengths.ts:86-95 (useRunGap)
- scenario: the gap is read on mount and on the root's resize only. The root is `position:absolute; inset:0` and its items are absolutely placed, so a theme/density switch that changes the token behind `column-gap` leaves the root's size alone: no resize fires and the run keeps laying items at the old gap until the root's box changes.
- evidence: read
- severity: low

## A text node removed from a parent that stays leaves the parent's `data-run-text-hides` behind
- where: packages/ui/src/components/Along/runText.ts:144 (drop)
- scenario: an item renders `<button>{on ? 'On' : null}<b>…</b></button>` (or any text node React removes while the parent element stays mounted). bendText no longer sees the removed node and calls `drop`, but by then `node.parentElement` is null, so the `!bends…some(…)` check is skipped and the button keeps `data-run-text-hides`. `-webkit-text-fill-color: transparent` stays on it and inherits to everything under it that has no copy of its own (pseudo-element `content`, list markers, text added later through a path the walk skips), which then draws invisible. The parent should be recorded on the `Bend` at `make` time and the attribute cleared off it on drop.
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

<!-- done: 4 findings, files read: 47 -->
