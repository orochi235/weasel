Retained text refill (A): fixed a7875045f9. A retained group's key now includes the latest in-place refill of any text inside it, so a refilled text gets redrawn. The `movesWithView` memo is redone after a refill too, so a refill that swaps in a screen-unit gradient is caught. The added per-frame cost is one lookup per retained group, and the text scan only happens on frames after some refill. That cost is estimated, not benchmarked, because fleet runs were out of scope.

Paint kind silently replaces a program held by `registerProgram`, and disposing the kind deletes it (A+B): fixed cd02c2e599. The kind now throws `ExtensionConflictError` when the program id already holds different source that no kind registered. A program `registerProgram` holds with the same source stays in place after the kind is disposed.

Paint kind replaces a `registerProgram` program (B): duplicate of A's paint-kind finding.

`chunks` tile drops `bg` when one chunk covers the tile (B): fixed 59394b4bca. The covering rect now goes on top of what was already drawn: the `bg` and any earlier chunks.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/patterns/tileGeometry.test.ts`: pass (12/12)
- `npx vitest run --maxWorkers=1 packages/renderer/src/paintKinds.programs.test.ts`: pass (9/9)
- `npx vitest run --maxWorkers=1 packages/renderer/src/retain/retainedKey.refill.test.ts`: pass (2/2)
- `retainedKey.test.ts`, `retainedKey.pbt.test.ts`, `RetainedSurfaces.test.ts`, `RetainedSurfaces.pan.test.ts`, `textBounds.test.ts`, `textCommand.test.ts`: pass
- Browser tests covering retained groups (`retain/*.browser.test.ts`): unrun
- `npm run checks:gate`: pass (all 33 passed)
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/renderer`: the package has no lint script. eslint on every changed `.ts` file: pass

tally: 3 of 4 fixed, 0 extra fixed