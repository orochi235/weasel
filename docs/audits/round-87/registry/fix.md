- `Reflectable.set` dropped the fallback mark of the registrant it replaced (from B): fixed a428f7fefd
- `deepEqual` compared an Array subclass instance structurally with a plain array (from A): fixed 325d02f94a
- `prototypePolluted` missed an `Object.prototype` member redefined with different attributes (from B): fixed 8e2b234811. There is no changeset because `testing/` is not exported.
- A child registry's listeners heard a held id go missing for one notification while the parent dropped it (from A): fixed a7f4de0963. The child's subscription to its parent now settles its holds before it notifies.
- A same-tick release and re-register in the parent turned the child's hold into a stale copy of its own (from A+B): fixed bf58c371d8. The takeover still happens at once, so the id never reads as missing. Then, in a microtask, if the parent resolves the id to the same value again, the child removes its copy and goes back to holding through the parent.

Each new test fails without its fix and passes with it.

Checks:
- `npx vitest run --maxWorkers=1 packages/registry/src/extensionRegistry.test.ts`: pass (18)
- `npx vitest run --maxWorkers=1 packages/registry/src/reflectable.test.ts`: pass (44)
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.test.ts`: pass (7). `deepEqual.pbt.test.ts` pass (6) and `deepEqual.meta.pbt.test.ts` pass (4).
- `npx vitest run --maxWorkers=1 packages/registry/src/testing/hostile.fixture.test.ts`: pass (2)
- `npm run checks:gate`: first run failed `check:size`, because `createExtensionRegistry` reached 131 lines. I split the takeover into `createLeans` and an `untake` helper, inside commit bf58c371d8. Rerun: "checks:gate: all 33 passed".
- `npm run check:changesets`: OK. Over-length title warnings remain only on changesets from earlier rounds.
- `npm run lint -w @weasel-js/registry`: the package has no `lint` script, so it did not run. Root `npm run lint` passed inside the gate.

tally: 5 of 5 fixed, 0 extra fixed