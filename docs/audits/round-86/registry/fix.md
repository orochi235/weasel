- A child re-registering the value its parent already resolves to takes a copy that shadows the parent (A) — fixed 3c5688a831 (the child now holds the value through the parent; the call was mine, recorded in `docs/unruled.md`)
- Same: a child's same-value registration is a change, not a no-op (B) — duplicate of the A finding above, fixed in 3c5688a831
- A cached `entries()` order shifts after the release microtask with no change to the key (A) — fixed 01fa29a6cd
- `deepEqual` overflows the stack on a cyclic value (A) — fixed 00efe39ec2 (this was "Open" in `docs/unruled.md`; my call there now: compare by shape)
- A parent's later registration is never checked against a child's id (B) — not a defect (scoping by design: the parent can't see its children, and checking them would let one host's child block a registration its siblings share; the doc now says so in 8c3b9c0602)
- Clash-warning dedupe can't tell an unnamed registrant from `source: ''` (B) — fixed 5852b1a2de

Two more commits are upkeep, not defects: bcb192dbe6 moves a function out so `check:size` passes after 3c5688a831, and 434b801e24 shortens my changeset titles to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.test.ts`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/registry/src/reflectable.test.ts`: pass (43/43)
- `npx vitest run --maxWorkers=1 packages/registry/src/extensionRegistry.test.ts`: pass (15/15)
- These consumers of the extension registry, which I didn't touch, also pass: `deepEqual.pbt.test.ts` and `deepEqual.meta.pbt.test.ts` (with `deepEqual.test.ts`, 16/16), `packages/renderer/src/paintKinds.programs.test.ts` (9/9), `packages/renderer/src/shaders/registerProgram.test.ts` (8/8) and `packages/core/src/core/ops/registry.test.ts` (13/13)
- `npm run checks:gate`: first run "checks:gate: 1 of 33 failed" (`check:size`, `createExtensionRegistry` at 121 lines); after bcb192dbe6, "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/registry`: fail, "Missing script: lint" (the package has none). Ran eslint on the changed files instead: pass
- `npm run check:changesets`: pass ("OK")
- The tree is clean apart from `.skulkr/`. A background watcher I'd left on the first gate run was stopped at its time limit; that run had already finished, so nothing was lost.

tally: 4 of 6 fixed, 0 extra fixed