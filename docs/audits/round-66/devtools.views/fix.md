RegistryBrowser filter freezes with `onFilterChange` but no `filter` (A): fixed ff02a9d5de
FrameView's `get-frame` poll lets a stale answer overwrite a newer one (A): fixed aa370a57b2
HistoryTable row click collapses the open step when the clicked step can't expand (A): fixed f4df38aeb0
StateView and FrameView `get-state` poll drops every read slower than 500 ms (B): fixed 1fde7c1168 (in `useRootQuery`, `packages/devtools/src/hooks.ts`: one read out at a time, and asking during a read queues one more after it, which covers every view that uses the hook)
Scene tree keeps the expanded ids of deleted nodes and asks for their children again on every notice (B): fixed 21e258d464
Coord table drops the canvas rect and never reads `fallback` (B): fixed 1370779ca2 (new Canvas column shows the rect origin; the fallback marker now reads `fallback`)

Checks:
- `npx vitest run --maxWorkers=1`, run one file at a time:
  - StateView.test.tsx: pass (5)
  - FrameView.test.tsx: pass (4)
  - RegistryBrowser.test.tsx: pass (18)
  - HistoryView.test.tsx: pass (5)
  - SceneView.test.tsx: pass (3)
  - CoordTable.test.tsx: pass (3)
  - DevtoolsPanel.test.tsx and DevtoolsPanel.registry.test.tsx, run because `useRootQuery` changed: pass (25)
- Each new test was seen failing before its fix.
- `npm run check:changesets`: pass ("OK — 7 changeset(s)").
- `npm run checks:gate`: pass ("all 32 passed").
- `npm run lint -w @weasel-js/devtools`: not run, because the package has no `lint` script ("Missing script: lint"). The root `npm run lint` inside the gate passed.
- Tree clean apart from `.skulkr/`.

tally: 6 of 6 fixed, 0 extra fixed