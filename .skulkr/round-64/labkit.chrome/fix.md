- Marks section checks staleness against the raw config while the canvas uses the resolved one (A): fixed c9a0ec9295
- `SidebarPanes` ignores `SidebarSection.fill` and gives the spare height to the last open section (A): fixed 6e1cbe9fbd
- A section's props are mapped from `SidebarSection` in two places, `Pane` and `sectionProps` (A): fixed f083812204 (no changeset, since nothing changes for a consumer)
- The `SuppressedAndReplaced` story replaces nothing (A+B): fixed 2dba530607
- `LabRegion`'s doc leaves out `aside`, and `EveryRegion`'s doc says five trial regions (A): fixed 1c7a1effca (`LabRegion` doc); the "six regions" correction is in 2dba530607
- A canvas trial whose view isn't 2D gets no FPS meter because it is gated on zoom (B): fixed 85c4f49791
- The story finding from B: duplicate of A's `SuppressedAndReplaced` finding

Extra:
- The duplicate-id error from `mergeContributions` advised "suppress the built-in before adding yours" (sweep). That can't work in a trial, because `suppress` applies after the merge, so the same id still collides. It now says to suppress the built-in and give the replacement another id: fixed 2cc7ca10e4

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/chrome/builtins.test.ts`: pass (28 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/chrome/merge.test.ts`: pass (9 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/chrome/regions/SidebarPanes.test.tsx`: pass (6 passed)
- `npm run check:changesets`: pass ("OK — 3434 changeset(s).")
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"; the first run failed lint on an unsafe optional chain in my new test, which I fixed and folded into c9a0ec9295)
- Browser tests: none touched, so none unrun.

tally: 7 of 7 fixed, 1 extra fixed