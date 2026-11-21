I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole findings document is below.

# Audit round 57: ui.components.Along

## Dragging a scrolling run across the seam of a whole-circle arc throws the scroll to one end
- where: packages/ui/src/components/Along/useRunScroll.ts:169 (`positionAt`), used by `onPointerDownCapture` at lines 118 and 122
- scenario: The user sets up `<Along arc={{ at: 0, span: '360deg' }}>` with a `Bar` or `Tabs` row too long for the circle, so the row scrolls. `arcInBox` returns equal ends, so `arcShape` is closed and so is the run. `positionAt` calls the closed `run.nearest(p)`, which returns a position wrapped into [0, 1]. When a drag crosses the start/end point, `travel` jumps by about ±`run.length` between two moves. `scrollTo(from - travel, 'jump')` then sends the row straight to its first or last item. What should happen is that the drag keeps going smoothly through the seam, which needs the nearest point taken open and anchored on the previous position (`{ open: true, about }`), the way `runText.lay` already does it.
- evidence: read (geom/src/track/run.ts:93-104: closed `nearest` and `closed` set from the shape; arc.ts:42; no closed-run test in useRunScroll.test.tsx)
- severity: medium

## Items in a scrolling curved Tabs, PageTabs or RadioGroup never get `touch-action: none`, so a touch drag pans the page
- where: packages/ui/src/components/Along/runRow.module.css:52 (`.root[data-scrolls] > .item`)
- scenario: The slot hosts (`TabListAlong`, `RadioGroupAlong`, `PageTabsAlong`) compose `.root` and carry `data-scrolls`. Their items, though, sit inside `RACTabList` or `.alongGroup`, so they are grandchildren of the root, not children. The `>` combinator never matches them, and nothing else in those modules sets `touch-action`. A touch press on a tab followed by a drag along the arc lets the browser start a pan and fire `pointercancel`, which ends the `useRunScroll` session without scrolling. Items in direct-child rows such as `Bar` do get the rule.
- evidence: read (Tabs/TabListAlong.tsx:31-36, RadioGroup.module.css:98-108, no `touch-action` in the Tabs, PageTabs or RadioGroup modules)
- severity: medium

## `useRunText` places its copies by bounding-box scale, which is wrong under a rotated ancestor, while `boxPoint` inverts the screen matrix
- where: packages/ui/src/components/Along/runText.ts:61-65 and 79 (`bendText`), plus `turnOf` at line 101
- scenario: A run row sits inside an element rotated by CSS. `boxPoint` explicitly supports that case ("a scaled or rotated ancestor maps it back"). `bendText` instead computes `scale = box.width / offsetWidth` from the axis-aligned bounding rect and maps client points with `(x - left) / scale`, with no rotation. `turnOf` reads only the item's own transform. The bent copy is therefore drawn offset and turned wrongly, while the real glyphs stay hidden by `data-run-text-hides`, so the label shows up in the wrong place. The same question (client px to run px) gets two different answers in two places.
- evidence: read
- severity: low

## Outside an `Along`, `CurvedLabel` is absolutely positioned over its containing block instead of being "a plain line of text"
- where: packages/ui/src/components/Along/CurvedLabel.module.css:1 (`.label`), rendered by CurvedLabel.tsx:57
- scenario: When `run === null`, the component renders `<div class={s.label}>{text}</div>`. `.label` is `position: absolute; inset: 0` with no condition. Placed in a flex row next to buttons, the label takes up no space and paints over the top-left of the nearest positioned ancestor, overlapping its siblings. The docstring promises "Outside an Along it is a plain line of text". The jsdom test only checks the text and the name, not the layout.
- evidence: read
- severity: low

## `useItemLengths` keeps the length of every key it has ever seen, with no bound
- where: packages/ui/src/components/Along/useItemLengths.ts:18-25 (`read`) and 36
- scenario: `known` is only ever written to. A `PageTabs` whose user keeps adding and closing pages (each with a fresh id) grows the map without limit. Every commit then copies the whole map (`new Map(known)`) and compares it with `same`, so the work per commit grows with the session's history rather than with the items currently drawn. The docstring says a change to `keys` "lets go of items no longer drawn", but only the `ResizeObserver` is reset. `known` should be pruned to the current `keys`.
- evidence: read
- severity: low

## `seenUnder` compares key lists by joining them with `'\n'`, so different lists can compare equal
- where: packages/ui/src/components/Along/runSlots.ts:159 (`seenUnder`)
- scenario: Slot keys come from consumer ids. Going from the keys `['a\nb']` to `['a', 'b']` (or the reverse) gives the same joined string, so `prev` is kept. The host then lays out and publishes the old key list, and the new slots read the fallback `{ [RUN_SLOT]: key }` with no place. `useItemLengths` in the same pipeline already keys on `compositeKey`, so the same question is answered two ways here.
- evidence: read
- severity: low

## The LensRim lab writes every mark to localStorage with no cap
- where: packages/ui/src/components/Along/lab/LensRimView.tsx:54-56, 63
- scenario: Every press on the picture adds a point, and `writeLocal(SAVED, marks)` saves the whole array on each change. Only "Clear marks" ever shrinks it. Over a long session the stored entry, and the list of rendered `<span>`s it restores on every load, grows without limit. It should keep only the last N marks.
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