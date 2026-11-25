- A finished or failed job with no total keeps sweeping (A+B): fixed eb1674231b. The bar now sweeps only while the job runs. After that it shows full for done and empty for error.
- A count past a revised total leaves `aria-valuenow` above `aria-valuemax` and outgrows the count's sizer (A+B): fixed 7884e7728d. One range, `max(total, count)`, now sets the fill, the ARIA range and the sizer.
- A finished job with failed items never fills its bar or reaches its total (B): fixed feb39db432. The bar and the count now show `done + failures.length`. `JobHandle.done` is documented as the items that arrived, and the `WithFailures` story now uses a state `useJob` can actually produce (`done: 118`).
- A controlled `Split` `width` isn't enforced, so a drag the parent rejects stays applied (B): fixed 8d70d7f6d5. This needed a behavior call nobody had made. My call is that `width` is fully controlled: after each reported drag the split re-renders in a transition, and the sidebar goes back to whatever width the parent renders. It's recorded in `docs/unruled.md` under "Audit round fifty-one".
- `A` and `B` are the same two findings for the sweep and the clamp, so I fixed each once.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/primitives/JobProgress.test.tsx` (new file): pass (5 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/primitives/Split.test.tsx`: pass (20 passed)
- Test files that use Split (`TrialBody`, `Trial`, `TitleBarRegion`, `SidebarPanes`, `labRegions`, `SidebarRegion`, `regions`, `ToolbarRegion`): pass
- `npm run check:changesets`: pass ("OK — 2541 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed on biome formatting and one hook-dependency error in the labkit lint step; I fixed those and squashed the fixes into their commits before the passing run.
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- Unrun: `JobProgress.browser.test.tsx`, which can't run here. I didn't change it, but it covers the count's width and the sweep, both of which these fixes touch.

The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed