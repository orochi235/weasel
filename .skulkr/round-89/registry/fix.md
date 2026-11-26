- Clash-warning memory grows without bound for a held key (A): fixed 79026f1f40. Each held key now remembers its last 256 source pairs, and a pair that gets pushed out warns again when it next clashes.
- deepEqual overflows the stack on deeply nested input (A): fixed c77f8d82e2. It now works through a list instead of recursing, so arrays or objects nested 100k deep compare without throwing.
- B reported no findings. The candidates it set aside are either already ruled in `docs/unruled.md` or match their docs.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/registry/src/reflectable.test.ts`: pass (45). The new test failed before the fix.
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.test.ts`: pass (8). The new test failed before the fix with `RangeError: Maximum call stack size exceeded`.
- `deepEqual.pbt.test.ts`: pass (6). `deepEqual.meta.pbt.test.ts`: pass (4). `valueStore.test.ts`: pass (1).
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/registry`: did not run, because the package has no `lint` script. The root `npm run lint` inside the gate passed.
- The tree is clean.

tally: 2 of 2 fixed, 0 extra fixed