- A missed mark change before the reader subscribes (A+B) — fixed 8b179a8188. `AnnotationsApi` gains `version()`, a count kept by the store. The trial's facade adds its input commits to that count. The changeset is `minor` because this is new API.
- PNG/SVG Copy loses the click's permission to write the clipboard (A) — fixed ea4414822d. The clipboard write now starts inside the click and holds the pending capture.
- `add` on a target with no content box leaves an empty scene behind (A+B) — fixed 4535c83464.
- A coalesced write that folds into an old entry doesn't move the undo order across targets (A) — fixed 454336300f. A scene now coalesces under a key that is unique to each undo group.
- The wheel is swallowed when a scroller rests a fraction of a pixel from its end (A) — fixed 53c5df0282. The fix applies to both ends.
- An SVG base without a `viewBox` is cropped in an export (B) — fixed 11c5c42fab. A `viewBox` is now built from the base's own width and height when those are in px.
- `setMeta` writes a legacy mark back unsettled (B) — fixed 4fdb2a8f2d.
- A stale text mark is drawn like a fresh one (B) — fixed d028bdb6c7. It now gets a dashed box, since text can't be dashed.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each test file I touched, one at a time: pass for all of them.
  - store.test.ts (45)
  - history.test.ts (10)
  - capture.test.ts (13)
  - paint.test.ts (25)
  - wheelScroll.test.ts (6)
  - ExportMenu.test.tsx (9)
  - AnnotationsContext.test.tsx (1, new file)
- Related files I didn't touch also pass:
  - store.pbt, history.persist, AnnotationOptions, markGesture
  - svgNodes, drawOne, labMarks, OverviewMarks, CalibrationResults
  - trial/Trial.annotations
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run lint -w @weasel-js/labkit`: pass (exit 0).
- `npm run check:changesets`: pass ("OK — 106 changeset(s)").
- Browser tests: none touched, none run.

tally: 8 of 8 fixed, 0 extra fixed