Slot-lookup dependency carries no `scene`, so boolean operands are outlined by the default painters (A): fixed 421219c241

Trimmed stroke's pick outline memoized without the silhouette's generation or key, so it goes stale (A): fixed 79c92342f3. The local silhouette it trims is now also built at the pick's view scale.

`buildSceneLayer` with a `toPose` derives paths from local poses, not world poses (A): fixed 722bf5e6a9

Group's drawn box reaches over hidden or consumed members (B): fixed b57049aa0c

`defaultPaintBounds` boxes a labeled group without its label when a painter claiming groups sets `drawsLabel` (B): fixed 3ec18dc815. Both functions now pick the painter through one `painterOf` helper.

End-anchored HUDs pinned against the window width including the scrollbar (B): fixed 24c0a2f749. The fix is in `useHostAnchor.ts`, which feeds `hostAnchor.ts`.

No extra defects found. A sweep of `contentBounds.ts` found that it already skips hidden nodes.

Checks:
- `npm run checks:gate`: pass (all 32 passed, on the second run; the first failed typecheck on an implicit `any` in a new test, now fixed)
- `npm run typecheck:packages -- core`: pass
- `npm run check:changesets`: pass (OK, 3215 changesets)
- `npm run lint -w @weasel-js/core`: none run, because `@weasel-js/core` has no `lint` script. eslint on the changed files: pass. The gate's root `npm run lint`: pass.
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `derivedPath.composed.test.ts`: pass (6)
  - `NodeShape.trim.test.ts`: pass (18)
  - `buildSceneLayer.derived.test.ts`: pass (5)
  - `drawnBounds.test.ts`: pass (19)
  - `defaultDrawOne.test.ts`: pass (13)
  - `useHostAnchor.test.tsx`: pass (3)
- Browser tests: none touched. `useHostAnchor.browser.test.tsx` covers start alignment only; it was not run here.

tally: 6 of 6 fixed, 0 extra fixed