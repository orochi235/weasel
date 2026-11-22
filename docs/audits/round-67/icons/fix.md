`override` skips the glyph check `add` applies (A+B): fixed c5a5e3bd90. `override` now throws the same `TypeError` as `add` on a glyph without a string `body` and `group` and an array of `tags`.

A loader handed over during a load that then fails never runs until a remount (B): fixed cba336afb9 (changeset title shortened in 2227aa8341). When the load that was running fails and its loader has since been replaced, the variant goes back to `idle` instead of `failed`, so a mounted `useIconVariant` loads the new one. I added a sentence on this to the existing 2026-11-20 entry in `docs/unruled.md`.

A provider's new `variants` value never drops a name the last one had (B): fixed 8203b6da3c. This is a strict call I made, now recorded in `docs/unruled.md` (2026-11-22). The provider's `variants` is now the current set. A new value drops every variant it no longer names: that variant reads `unknown`, the tables it loaded are released, and a load still in flight for it adds nothing. This works through a new option, `provideVariants(loaders, { replace: true })`. Without the option, `provideVariants` still only adds, so the earlier ruling still holds. The changeset is `minor`, tagged `fix api`, because the option is new API.

Checks:
- `npx vitest run --maxWorkers=1 packages/icons/src/registry.test.ts`: pass (29 tests). The new tests failed before the fixes.
- `npx vitest run --maxWorkers=1 packages/icons/src/react/iconRegistry.test.tsx`: pass (11 tests). The new test failed before the fix.
- `npm run check:changesets`: pass ("OK — 101 changeset(s)").
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run lint -w @weasel-js/icons`: not run, because the package has no `lint` script. In its place, `eslint packages/icons/src`: pass, and the root `npm run lint` passed inside the gate.
- The tree is clean.

tally: 3 of 3 fixed, 0 extra fixed