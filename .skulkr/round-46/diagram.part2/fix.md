Five findings fixed with a regression test each, and one filed as too big for this pass.

- Live run leaves the cancelled run's eased edge paths on the override channel after `restart`, a pending `stop`, or a throwing step (A+B) — fixed 62b13bbf44. 7fae6bfd11 moves the step's pin filter and throw guard into helpers to stay under the size cap.
- Spec label placer's cache key leaves out `inset` (A+B) — fixed 0ae667b4d2. The key now covers the whole preferred placement except `placed`.
- Spec label placer scores a split connector's label on the undrawn cross-page route instead of its stubs (B) — fixed 3043d304b1.
- `diagramScene` reserves layout room for labels the `labelPlacement` option puts at an end or a fraction (B) — fixed 72e374f284.
- `buildGraph` keeps an edge from a region to its own member as a self-loop on the region (B) — fixed 40aed9961d. A node's own self-loop is still kept, and the test checks that.
- `buildGraph` lays a fitted container out as one rigid box (B) — question, filed e7db0daf32 as a (P2) entry in `docs/TODO.md`. The defect is real: `buildGraph` gives nodes `["k","src"]` and the edge `src→k`, with no cluster. Making it a cluster is easy. The rest isn't: the container's box would need re-fitting after every layout write and every live frame, while its members are stored in its frame, and `layoutPoses` can only translate poses. That's too big for this pass.
- No extra defects found while fixing. 23d3660135 shortens three changeset titles that `check:changesets` rejected for length.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `live.test.ts`: pass (19)
  - `live.planner.test.ts`: pass (9)
  - `liveRoutes.test.ts`: pass (4)
  - `liveRoutes.preview.test.ts`: pass (3)
  - `labels/specLabels.test.ts` (new): pass (2)
  - `labels/labels.offPage.test.ts`: pass (3)
  - `labels/place.test.ts`: pass (9)
  - `fromData.test.ts`: pass (35)
  - `fromData.pages.test.ts`: pass (8)
  - `graph.regions.test.ts`: pass (3)
  - `graph.test.ts`: pass (8)
  - `DiagramView.labels.test.tsx`: pass (4)
  - No browser test touched.
- `npm run checks:gate`: first run failed (`check:size`, `live.ts` longest function 127); after 7fae6bfd11, "checks:gate: all 32 passed".
- `npm run check:changesets`: "OK — 2031 changeset(s)".
- `npm run lint -w @weasel-js/diagram`: fail, "Missing script: "lint"" — the package has no lint script. Ran `npx eslint` on every changed package file instead: pass.
- Tree clean; `.skulk/` untouched.