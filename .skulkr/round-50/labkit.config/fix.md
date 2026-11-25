- `sectionTree` / `configVerdict` ignore `over`, so the rail form judges conditions differently from the panel (A+B): fixed 834e62da6a
- A section's switch inside a group's `object` leaf is disabled by its own `enableIf`, because relative keys are compared against root paths (A): fixed 56e6e67446
- Same finding as the line above (B): duplicate of A's "section's switch inside a group's object leaf"
- `prefsFromConfig` / `f.prefs` lose the schema's admitted selectors (A): fixed e62b242f7d
- An `f.object` / `f.list` / `f.map` / `f.union` inner node skips the rule chain and drops its options (A): fixed f46b34901e. Inner nodes now go through the built-in rules when built and the lab's `configRules` when resolved. Options that only a row can act on now throw. That throw is a strict call with no ruling yet, recorded in `docs/unruled.md`.
- An enumerating resolver sees only the auto paths already resolved, so declaration order still decides (A): fixed 00721101ed
- The demand proxy breaks its invariants when given a frozen config (A): fixed b3d63fa05c
- `titleCase` runs an acronym into the next word, e.g. `maxURLLength` → "Max urllength" (A): fixed 3a002637f8
- `f.custom`'s `validate` is lost through `prefsFromConfig` / `f.prefs` (A): fixed ad0c573538
- `BaseNode.auto` docs and `.initial()`'s error name the removed `auto` export (A): fixed a914e8999a
- `f.custom`'s `validate` is stored and never run (B): not a defect. Forge's `answerSchema` (`packages/forge/src/protocol/schema.ts:142`) runs it, and `ControlPanel` takes the resulting `errors` from its caller. The part that was real, losing `validate` in the prefs round trip, is fixed in ad0c573538.
- `f.curve().range()` accepts bounds `f.number().range()` rejects (B): fixed 2b891d54e1

Extra defects:
- `labkit` lint's design-token check failed on a raw `px` in `font-size` in `packages/ui/.../SpanStrip.module.css` (sweep). It was already failing on the frozen tree: fixed bb9adcb446, by putting the stripe's height in one property that both font-size and line-height use.
- `check:numeric` failed on `apps/draw/src/dev/audits/Treemap.module.css`, which used `tabular-nums` instead of composing the theme's `.numeric` class (sweep). It was already failing on the frozen tree: fixed 0ec0ee51c1.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for all of these:
  - `sectionTree.over.test.ts` (new), `sectionTree.test.ts`, `sectionTree.enableIf.test.ts`
  - `fromPrefs.test.ts`, `resolve.test.ts`, `builder.test.ts`, `rules.pbt.test.ts`, `conditions.test.ts`
  - `autoConfig.test.ts`, `autoConfig.pbt.test.ts`
  - `controls/compoundRows.test.tsx`, `controls/inDialog.test.tsx`, `controls/ControlPanel.compoundConditions.test.tsx`
  - `forge/src/csf/argsToSchema.test.ts`
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint -w @weasel-js/ui`: not run, because ui has no `lint` script. The root `npm run lint`, which is part of the gate, passed.
- `npm run check:changesets`: pass ("OK — 2407 changeset(s)")
- Tree is clean.

tally: 11 of 13 fixed, 2 extra fixed