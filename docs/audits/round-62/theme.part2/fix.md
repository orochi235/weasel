[r56-1] `tree-indent` hook records a fallback the Tree's CSS never takes, carried: fixed 77a84d9b1e. The hook now lists `calc(13px + var(--wzl-space-2))`, the indent a default Tree takes. `check:token-reads` no longer skips hooks marked `varies`: it fails one whose listed value no read falls back to. To see the real fallback, it follows the stylesheet's own custom properties and any private property the hook is handed on to.

[r57-3] `useColorModePreference` keeps the old storage's choice when `storage` changes under the same key, carried: fixed df1cae2bda. It now reads the choice again from the new `storage`. A storage object made fresh on every render reads again each time but only stores a change, so it doesn't loop. A test covers that case.

Extra defects:
- `--wzl-select-border` lists a value no read takes (`1px solid var(--wzl-border)`; a boxed trigger really draws `--wzl-field-border`'s fallback), sweep (found by the extended check): fixed 112ab3f7dd
- `--wzl-button-confirm-bevel` lists `var(--wzl-bevel-raised)` and drops the `var(--btn-relief)` fallback its only read carries, and was marked `varies` without cause, sweep (found by the extended check): fixed b5995a573e

Checks:
- `npx vitest run --maxWorkers=1 scripts/check-token-reads.test.ts`: pass (24 passed)
- `npx vitest run --maxWorkers=1 packages/theme/src/generated/generated.test.ts`: pass (17 passed)
- `npx vitest run --maxWorkers=1 packages/theme/src/colorMode.test.tsx`: pass (14 passed)
- `npm run check:changesets`: pass ("OK — 3213 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/theme`: not run, because the package has no `lint` script (npm error: missing script). The root `npm run lint` passed inside the gate.

tally: 2 of 2 fixed, 2 extra fixed