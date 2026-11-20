Snip preview ignores a tuned `snipPath` radius (A): fixed 7323714cb8
Spiro deactivation leaves the snap trail session and pointer follower open (A+B): fixed 8587e6ffe9
`configureWarp`/`expandWarp` enabled by a stale warp (A+B): fixed 982af2a6dd. Warp Settings is now enabled only by a warp that still makes its shape. Expand Warp keeps the looser check on purpose (A's suggestion), because dropping a stale warp still changes the document.
A warp tool attached to two canvases loses the first one (A): fixed cdde202b7f. Each canvas now gets its own handle layer reading its own deps, and activating the tool redraws every attached canvas.
NaN rows/cols reach `resizeCloth` (A+B): fixed 3a70c81bf2. `warpSettingOf` now rejects non-finite numbers. The same gap was in `tolerance` (Infinity got through), and that is fixed in the same commit.
A warp begun on text whose face is still loading never converts it (B): fixed 7e82595f39 for the drag. The drag now keeps its grab and converts the text on the first move after the face loads. `OutlineSession` gained `waiting()`, and `outlineScene.ts` gained a `registerTestFont()` test helper. `pin.addPin`, the single-call case B also named, is unchanged: it is one immediate click and can't wait, so a click on still-loading text does nothing and the next click converts it.

Extra defects: none beyond the tolerance case above, which is part of the NaN fix.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `useSpiroTool.test.tsx` 3 passed, `warpActions.test.ts` 16 passed, `warpSettings.test.ts` (new) 2 passed, `useSnipTool.test.tsx` 2 passed, `useWarpTool.test.tsx` 3 passed, `warpGroupsText.test.ts` 13 passed. Each new test failed before its fix.
- warp, knead, snip, spiro, and shared directories together: 97 passed.
- `npm run checks:gate`: the first run failed only `check:changesets` (three titles over 140 characters). I shortened them in the commits they belong to, rewriting only my own commits on top of the frozen commit. Rerun: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/path-tools`: the package has no `lint` script. `npx eslint` on the changed directories: clean.
- `npm run check:size`: "no file or function grew past its cap".
- Working tree clean.

tally: 9 of 9 fixed, 0 extra fixed