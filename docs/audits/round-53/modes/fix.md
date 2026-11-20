- `isShippedTag` narrows to `CapabilityTag`, so a string it rejects narrows to `never` (A+B): fixed f1ff2d6908. It now narrows to the new exported `ShippedTag`.
- Shipped preset `ModeDefinition`s are shared mutable objects, so `createActiveModeReader` serves stale tags after a change in place (A): fixed 300319077f. The presets and `DEFAULT_MODES` are now deeply frozen, so changing one in place throws. This is a strict call I made, recorded in `docs/unruled.md`. The registry still doesn't copy or freeze an app's own definitions; that part is recorded there as the remaining gap.
- `PATH_EDIT`'s doc says it starts on "core's `anchors` tool", but that tool is in path-tools (B): fixed 2d581281bf. It was a doc-only change, so it has no changeset.
- Same `isShippedTag` finding as reported in B: duplicate of the first line (A+B).

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/modes/src/capabilities.test.ts`: Tests 4 passed (4). It failed typecheck before the fix with 4 errors.
- `npx vitest run --maxWorkers=1 packages/modes/src/presets/default.test.ts`: Tests 10 passed (10). It failed before the fix (1 failed | 9 passed).
- `npx vitest run --maxWorkers=1 packages/modes/src`: Tests 64 passed (64).
- `npm run check:changesets`: OK — 2539 changeset(s).
- `npm run checks:gate`: all 32 passed.
- `npm run lint -w @weasel-js/modes`: not run, because the package has no lint script. The root `npm run lint` passed inside the gate.

tally: 4 of 4 fixed, 0 extra fixed