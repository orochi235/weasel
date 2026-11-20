feasel-skulk report, area `prefs-schema`

prefDisplayBounds reads direction from rounded values (A+B): fixed 508378a675

union field reads as UNSEEN when another variant reaches it through a list (A): fixed 77a6d1cb12. The variant that can't be seen into now stands as a placeholder leaf (`UNSEEN_LEAF`) that no reader judges, so `checkPrefCondition` stays silent for it. Before, that variant dropped out, and the condition check would have flagged values the other variant can hold. A test in `packages/prefs/src/condition.test.ts` guards this.

prefReader takes the first prefix key over an exact section key (A): fixed 2695e19f2b

prefObjectBase calls `fromScalar(undefined)` when nothing is held (A): fixed 132a2ce539

assignPrefValueAt / nestPrefValues throws through a primitive branch (A): fixed bf1d73131a. The later entry wins.

repairPrefValue skips a dotted object field stored nested (B): fixed 5c862c6433

prefStatusAt takes a prefix sibling over the exact dotted key (B): fixed eba2d5c8d9. This is the same mistake as the prefReader finding, at a different site. No other first-prefix walks are left in the package.

PrefValueOf types a clearable number as `number` (B): fixed 8560e57dc7. `pref.number` now returns a non-clearable leaf, the way `pref.enum` already does, so built schemas keep `number`. The ui kit-settings `ms`/`px` helpers no longer widen their return to `PrefNumber`. With the widened type they would have read as `number | undefined`.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file, all pass:
  - helpers.test.ts 25
  - holding.test.ts 3
  - status.test.ts 20
  - object.test.ts 10
  - repair.test.ts 32
  - paths.test.ts 11
  - prefs/condition.test.ts 32
  - ui PrefsForm.test.tsx 36
- `npm run typecheck`: pass.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on `check:changesets` because 2 titles were over 140 characters. I shortened them and squashed the fixups into their commits.
- `npm run lint -w <pkg>`: none of prefs-schema, prefs, or ui has a `lint` script ("Missing script: lint"). I ran eslint on every changed file instead: pass.
- No `*.browser.test.*` files touched. Tree clean.

tally: 8 of 8 fixed, 0 extra fixed