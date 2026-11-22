A canceled timeline still shows as playing (A): fixed 5cb0fae4dd. `TimelineHandle` gains `isCanceled()`, and `useTimelinePlayback` treats a canceled handle as not advancing, so the button shows Play and the frame loop stops. The new handle method has its own animator changeset at `minor` (new API), and the UI fix has a `patch` changeset.

A tool carry released past the slop with no move past it first still picks the tool (B): fixed 52f3c045bc. `onEnd` now checks the release event against `gestures.dragPx` too. Nothing else in the area makes the same mistake.

Checks:
- `npx vitest run --maxWorkers=1 packages/animator/src/timeline/playback.test.ts`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Transport/useTimelinePlayback.test.tsx`: pass (6/6); its new test failed before the fix
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Transport/AnimatedTransport.test.tsx`: pass (2/2)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/ToolPalette/ToolPalette.layout.test.tsx`: pass (11/11); its new test failed before the fix
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed `check:size` because `createTimeline` reached 121 lines; I shortened a comment and squashed that change into 5cb0fae4dd.
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/ui` and `npm run lint -w @weasel-js/animator`: not run, because neither package has a `lint` script ("missing script"). Instead I ran eslint on every changed `.ts` and `.tsx` file: pass.

tally: 2 of 2 fixed, 0 extra fixed