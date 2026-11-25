useVisibleRaf runs onSuspend from a stale intersection report after unmount, and leaves the loop marked suspended (A+B): fixed dce2aafea0

useVisibleRaf loop stays suspended when its out-of-view target leaves the document (B): fixed d86b8971cd

useNotified throws in a server render because it passes no server snapshot (B): fixed 9601f3a6e3

leakProbe leaves its own once helper on the target when a once listener is removed by hand (A): fixed 3673a94bbe

No extra defects found while fixing. The sibling observers in `useNearViewport.ts` and `watchElementMove.ts` already ignore stale reports.

Checks:
- `npx vitest run --maxWorkers=1 packages/react/src/useVisibleRaf.test.tsx`: pass (24/24)
- `npx vitest run --maxWorkers=1 packages/react/src/useNotified.test.tsx`: pass (3/3)
- `npx vitest run --maxWorkers=1 packages/react/src/testing/leakProbe.test.tsx`: pass (26/26)
- `useVisibleRaf.pbt.test.tsx`, `useVisibleRaf.phase.test.tsx`, `useVisibleRaf.cancelThis.test.tsx` and `useElapsed.test.tsx` (not touched, but they import the changed hook): pass
- `npm run checks:gate`: pass (all 33 passed)
- `npm run lint -w @weasel-js/react`: not run, because the package has no `lint` script. I ran `npx eslint` on all six changed files instead: pass
- `npm run check:changesets`: pass

tally: 4 of 4 fixed, 0 extra fixed