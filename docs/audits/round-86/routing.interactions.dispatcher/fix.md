Nested OS drop handled by both the inner and outer surface (A+B): fixed 351132e579

`dispatcher` option ignored after first render (A+B): fixed 33ab5bc9d0

Teardown leaves the trace's live prediction set (A+B): fixed 8c45a8f66d

Teardown leaves the painted cursor's pointer set (A+B): fixed 8c45a8f66d (same commit as the trace finding, since both are withdrawn by one teardown path)

Hover binding on an ongoing action logs console.error on every move (B): fixed 29ceacccc4. The `pointerDown` spec with the same error is deduplicated in the same commit.

Window blur mid-pinch resets the step baseline (B): fixed e035f39264

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: dispatcher.misbound.test.ts pass, useGestureDispatcher.dispatcherOption.test.tsx pass, useGestureDispatcher.nested.test.tsx pass, useGestureDispatcher.paintedCursor.test.tsx pass, useGestureDispatcher.pinchBlur.test.tsx pass. I also ran the neighboring ingest, dropPreview, dropView, hoverCursor, hover, listeners, abandon, redraw, toolSwitch and ongoing tests, plus core's viewport.safari.integration and minimap's wheel and minimap tests: all pass.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/routing`: unrun, because the package has no `lint` script (npm error: missing script). eslint on every changed file: pass.
- `npm run check:changesets`: pass, with no warnings on the 5 new changesets.

tally: 6 of 6 fixed, 0 extra fixed