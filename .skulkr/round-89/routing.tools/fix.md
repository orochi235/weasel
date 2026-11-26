Tool-options tuning follows mode-gated routing (A) — fixed a01e07ce41
Wheel reversal with zero leftover travel not seen as a new burst (A) — fixed e8b94b1776
`ToolsScope` remounts children when `isolate` or the outer scope changes (A) — fixed 3f78cfd7bc
`findConflicts` merges ties that are not transitive into one conflict (B) — fixed 300f44f512
`toolOptionsPrefs` doesn't widen list, object, map or union shared leaves (B) — fixed 82845574e1. I made the strict call: two tools that declare such a leaf differently, beyond its wording, now make it throw. I recorded the call in `docs/unruled.md`.
[r88-3] Wheel burst state shared across canvases (carried) — not a defect (no longer applies: bursts are now kept in a `WeakMap` keyed by each canvas's `toolOptionValues`)
[r88-7] Code spec against key spec for the same physical key not flagged (carried) — not a defect (no longer applies: f31c2f61ba added the letter a `code` types to its buckets, and `conflicts.code.test.ts` covers it)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on `tuneToolOptions.test.ts`, `toolOptionSteps.test.ts`, `toolOptionSteps.pbt.test.ts`, `toolOptionSteps.shrunk.test.ts`, `toolsScope.test.tsx`, `toolOptionPrefs.test.ts`, `toolOptionShare.test.ts`, `useToolOptionValues.test.tsx`, every `routing/reflection/*.test.ts`, `apps/draw/src/prefs.test.ts` and `apps/draw/src/prefs.roundTrip.test.ts`: pass. The property test's model still had the old reversal rule; I updated it to the new one.
- Each new test failed with its fix reverted (shown for the wheel, scope, conflict and tuning fixes).
- `npm run check:changesets`: pass ("OK — 1490 changeset(s)"; the only warning shown is on an existing changeset).
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w <pkg>`: neither `@weasel-js/routing` nor `@weasel-js/core` has a `lint` script (npm error, missing script). Root `npm run lint` passed inside the gate, and `npx eslint` on the changed routing and core files exited 0.

Tree clean.

tally: 5 of 7 fixed, 0 extra fixed