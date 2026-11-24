A+B Windows story-file keys (story files keyed with backslashes on Windows, but vite's ids use slashes) — fixed 9f1cb2c698
A: type imported under another name had its definition filed under the original name — fixed c0bc27e18e
A: conditional nested in a conditional's check or extends position printed without parentheses — fixed 98cbbebb61
B: Windows story-file keys — duplicate of the A+B line above (fixed 9f1cb2c698)
B: `fileEventsArrive` set a bare `setTimeout` from `waitMs`, so an infinite or too-long wait answered false at once — fixed da16b28997 (internal only, no changeset)
B: the issues endpoint accepted any array of objects as a list of issues — fixed 392a65248d

Checks:
- `npx vitest run --maxWorkers=1` on `typedoc/typedoc.test.ts` (23), `apiTable.test.ts` (27), `watchProbe.test.ts` (14), `issues/endpoint.test.ts` (9), `posixPath.win32.test.ts` (1), `posixPath.test.ts` (1), `storyIndex.test.ts` (3), `plugin.test.ts` (30), `propControls.test.ts` (7), `watchRecovery.test.ts` (7): pass
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run check:changesets`: pass ("OK"); no warnings on this pass's changesets
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script; the root `npm run lint` passed inside the gate

tally: 6 of 6 fixed, 0 extra fixed