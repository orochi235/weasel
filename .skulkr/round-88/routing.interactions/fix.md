- Option+letter Alt chords reserved on a Mac even though the text says Windows and Linux (A): fixed 5f44431646
- Shifted screenshot digits `#`, `$`, `%` with Mod+Shift not reserved on a Mac (B): fixed b4d61b027c
- `startThresholdDrag` reports a release past the threshold as a click when no move crossed it (A): fixed 257a3169f5. This covers a real `pointerup` only. A missed release (a move after the button came up) still follows round 85's ruling, because its point is not where the button was let go.
- Chorded mouse drag keeps going after its own button is released (B): fixed b44f8461d3. A move that no longer holds any of the press's buttons now counts as the release.
- Carry dropped outside the browser window lands on a surface whose element runs past the viewport (B): fixed 87cebb023c. A `null` hit counts as no surface when the host can hit-test (new `canHitTest` in `elementAt.ts`).
- `useHandleDrag` misses fixed-box containers made by `will-change`, `backdrop-filter`, and `container-type` (A): fixed f4b024e206. The same fix also covers `content-visibility` and the `translate`, `rotate`, and `scale` properties.
- `useHandleDrag` stops collecting scrollers at a shadow root (B): fixed 905e118edf. The walk follows the flat tree, so it goes through slots to the host too.
- Sticky box's scroller dropped on both axes, and even while the box is not stuck (B): fixed e401425e00. On an axis with an inset, the walk reads how far the box has moved inside its scroller; on the other axes it adds the scroll.

Extra: none. Commit 825cc942c0 only shortens the titles of the changesets above to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `browserReservedKeys.test.ts` pass (22), `thresholdDrag.test.ts` pass (27), `pointerSession.test.ts` pass (24), `pointerSession.pbt.test.ts` pass, `carry.test.ts` pass (5), `carry.pbt.test.ts` pass, `sweep.test.tsx` pass (10), `handleDrag.test.ts` pass (35).
- These related files also pass: `useGestureDispatcher.pointerRecovery`, `useGestureDispatcher.secondaryDrag`, `useGestureDispatcher.penButtons`, and `useGestureDispatcher.multiPointer`; plus three run together: ui `menuBarReservedKeys`, core `browserReservedBindings`, and path-tools `browserReservedBindings`.
- Unrun: no `*.browser.test.*` file was touched.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/routing`: fails with "Missing script: lint", because routing has no lint script. `npx eslint` on every changed .ts/.tsx file instead: pass (exit 0).
- `npm run check:changesets`: OK
- Tree clean.

tally: 8 of 8 fixed, 0 extra fixed