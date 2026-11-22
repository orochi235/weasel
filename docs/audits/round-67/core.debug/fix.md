`ids` labels drawn outside their node's box on a flipped (y-up or x-flipped) view (A+B): fixed fe57c0c3e8

A highlight from a render React throws away sticks, because `useDebugSink` writes it into the live config inside `useMemo` (A+B): fixed 5615a805f1

An override that toggles between "shows something" and "shows nothing" rebuilds the debug sink and overlay each time (B): fixed b2eaccd2d7. The sink is now keyed on the resolved config, not the raw `debug` prop. When debugging is on through `?debug=`, a hover highlight coming and going no longer replaces the sink, so its frame-rate history and recorded viewport survive. When debugging is otherwise off, a highlight-only override still creates a sink and dropping it removes the sink. That is a real off-to-on change, and that sink has no features on, so it holds nothing to lose.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/debug/createDebugOverlayLayer.test.ts`: pass (14 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/useDebugSink.test.ts`: pass (6 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/debug/override.test.ts`: pass (3 passed)
- `npm run check:changesets`: pass (`[changesets] OK — 101 changeset(s).`)
- `npm run checks:gate`: pass (`checks:gate: all 32 passed`)
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. eslint on the changed files: pass, and the gate's root `npm run lint` passed.

tally: 3 of 3 fixed, 0 extra fixed