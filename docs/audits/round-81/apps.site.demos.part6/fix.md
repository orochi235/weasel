scoreRoll draws an all-silent bar at full opacity (A): fixed 5cda945c43

visualOrder swaps adjacent same-direction strings instead of treating them as one run (B): fixed 82e82f43da

Trial clock readout shows 0.00s until the clock next moves (B): fixed 6641d99d61

No extra defects found. No changesets: `apps/site` is not a published package.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/scoreRoll.test.ts`: pass (4 passed)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/shapedVisualOrder.test.ts`: pass (6 passed)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/TrialClockDemo.readout.test.tsx`: pass (1 passed)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/TrialClockDemo.test.tsx`: pass (2 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed", root `npm run lint` included)
- eslint on the six changed files: pass (no output)
- `npm run lint -w <pkg>`: not run, because no package changed (the changes are all in `apps/site`)

tally: 3 of 3 fixed, 0 extra fixed