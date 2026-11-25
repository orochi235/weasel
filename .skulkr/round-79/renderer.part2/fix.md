- A pattern tile that failed before `OffscreenCanvas` existed was never retried once another spec failed under the new canvas (A): fixed c48a24cec5 (changeset title shortened in e155e99748)
- `movesWithView`'s memo goes stale when a text command is refilled in place (A): not a defect. `movesWithView` only serves retained groups, and `GroupDrawCommand.retain` says "`children` must not be mutated once drawn". A text refilled in place inside a retained group already breaks that contract, and the retained key misses the same refill for the same reason.
- A loader uncovered by disposing the loader that displaced it mid-load never loads its kind again (B): fixed b47b00459c
- Two kind ids declaring one program id: the later one silently takes it, and disposing that one deletes the other kind's program (B): fixed bab4e6cd46, with a follow-up for the gate in b189fc93ba. This was my own behavior call, so I recorded it in `docs/unruled.md`. A kind declaring a program id that a kind of another id holds with different source now throws `ExtensionConflictError`. An override under the same kind id still replaces the program.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each test file I touched: `patterns/resolveSpec.test.ts` pass (17), `paintKinds.loaders.test.ts` pass (7), `paintKinds.programs.test.ts` pass (7).
- Related test files, also pass: core `paintKinds.test.ts`, paint-kinds `paintKinds.test.ts` and `usePaintKinds.test.tsx`, `WeaselRenderer.paintResources.test.ts`, `draw.paintPrecision.test.ts`, `paintBind.colorMatrix.test.ts`, `paintKinds.pbt.test.ts`, pdf `drawCommands.test.ts`, svg `gradients.test.ts` and `DrawCanvas.test.tsx`.
- `npm run checks:gate`: the first run failed one of 33 (`check:proto-index` at `paintKinds.ts:171`). After the fix: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/renderer`: fail, `Missing script: "lint"`. The renderer package has no lint script. The gate's root `npm run lint` passed, and eslint on the changed files passed.
- `npm run check:changesets`: pass, no warnings on the three new changesets.
- Tree clean.

tally: 3 of 4 fixed, 0 extra fixed