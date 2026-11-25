# Audit round 65 — prefs

## mergePrefGroups drops every input root's `admits`, so a merged schema admits no selector
- where: packages/prefs/src/merge.ts:29 (mergePrefGroups)
- scenario: two schemas, each with `admits: ['doc.layout']` on its root and a pref whose `scopes` names `doc.layout`, are composed with `mergePrefGroups('Kit', a, b)`. The result is `{ name, children }` only, so `admittedSelectors(merged)` is empty: `createPrefsStore` warns `selector "doc.layout" is not admitted by this schema (it admits none)` for every such pref, `selectionAt` refuses `at: { 'doc.layout': … }` (it is neither a leaf selector nor admitted), and reads/writes under that selector silently go to the shared member. Merging should union the inputs' `admits` (the doc says only "the first one's own fields kept" for groups at the same key, and the root is not one of those).
- evidence: read (`admits` is read on a schema's root only, packages/prefs-schema/src/groups.ts:74-78; `admittedSelectors` reads `schema.admits`, splitCheck.ts:45)
- severity: medium

## A write to a closed store does not change what it reads, contrary to `PrefsStore.closed`'s contract
- where: packages/prefs/src/store.ts:232 (createPrefsStore, `close`) with store.ts:142 (the cache subscription that drops the snapshot)
- scenario: `const s = openPrefsSync(schema, …); s.get('density')` (builds the snapshot, 72); `await s.close(); s.set('density', 100); s.get('density')` → still 72. `close` calls `stopCache()`, and the snapshot is only ever dropped from that cache subscription, so after close no write (set, reset, setAuto) reaches `drop()`; `get`, `values`, `auto`, `unset`, `scopes` keep returning the pre-close snapshot (and `stored()` its memoised tree). The same holds for a `usePrefsStore` store after its `lent` cache is swapped for the private copy. The interface says "A write after that changes what this store reads and reaches neither storage nor its subscribers" (store.ts:76-78); only the second half holds. Only a store whose snapshot was never built reads the late write.
- evidence: read (no test reads back a closed store's write: store.test.ts:190-203, usePrefsStore.test.tsx:187-204 check only the warning and the other store)
- severity: low

## prefsCss's root block uses each selector's `default`, while a store or defaults source at defaults reads a selector that starts auto at its `auto.value`
- where: packages/prefs/src/css.ts:118 (prefsCss, `defaults`)
- scenario: selector `mode` is an enum `{ default: 'light', auto: { on: true, value: 'dark' } }` (allowed: its auto value is an option, splitCheck.ts:24), and `accent` is split by `mode` with `$in: { light: '#fff', dark: '#000' }`. A fresh store and `createDefaultsSource` both read `mode` = `'dark'` and `accent` = `'#000'` (snapshot.ts:126 / defaultsSource.ts:18 take the selection from the held auto value). `prefsCss(createDefaultsSource(schema))` — what the vite plugin serves — writes the unattributed `:root` block as `--mode: light; --accent: #fff`, the member of `default`, so a page that sets no attribute (the case the root block exists for) shows the opposite theme from what the schema reads at defaults. The root block should be built at the selection a store at defaults reads (`unsetHeldOf` per selector), not at `leaf.default`.
- evidence: read
- severity: medium

## A migration that renames a leaf strands the leaf's auto mark at the old key
- where: packages/prefs/src/migrate.ts:43-46 (runPrefsMigrations)
- scenario: v0 has leaf `grid.size` (auto-capable, starts pinned); the user turned it auto, so `grid.size` holds `{ $at: 0, $auto: true }`. Migration 0 renames `grid.size` → `grid.step` (the documented use: "rename, transform or delete entries in `records`, keyed by leaf path"). Marks are filtered out before migrations run and never handed to one, so after open `grid.step` has nothing stored (pinned at its default) and a dead `{ $auto }` record stays at `grid.size` forever; the user's auto choice is lost. A rename can carry a value but has no way to carry the auto state; marks should go through the migration as entries (or be moved with a renamed key).
- evidence: read
- severity: low

## `stored()` shows an auto mark's internal record as if it were the leaf's stored value
- where: packages/prefs/src/store.ts:98 (storedRecords)
- scenario: a pinned-start auto-capable leaf `view.zoom` is turned auto (`setAuto('view.zoom', true)` stores `autoRecord(version)`). `store.stored()` documents "every stored record as a nested tree, unrepaired": values come out unstamped (`recordValue` strips `{ $at, value }`), but the mark is not a stamped record, so `stored().view.zoom` is `{ $at: 0, $auto: true }` — an object that reads as a value of the leaf (and for an object leaf, a malformed one). `usePrefsState().stored` hands it to UI as such. The mark should be left out (or shown as an explicit auto marker), as `isSet`/`auto()` already interpret it.
- evidence: read
- severity: low

## A color blend's weights overflow where the number blend guards against it
- where: packages/prefs/src/blend.ts:36 (blendColor)
- scenario: `store.get('accent', { weights: { mode: { light: 1e308, dark: 1e308 } } })` on a color split by `mode`. `blendNumber` rescales by the heaviest weight ("so no product or total overflows"), so a number leaf blends 50/50. `blendColor` hands the raw weights to `mixRgbaWeighted`, whose running total becomes `Infinity` at the second member, so `weight / total` is 0 and the result is the first color alone instead of the midpoint. The two built-in blends handle the same weights differently. Normalizing by the heaviest weight before mixing (as `blendNumber` does) fixes it.
- evidence: read (packages/paint/src/mix.ts:41-46)
- severity: low

## orderPrefGroup rebuilds every actions leaf an order names, even when nothing moves
- where: packages/prefs/src/order.ts:62 (orderChild)
- scenario: `orderPrefGroup(group, { 'tools.run': ['a', 'b'] })` where `tools.run` is an actions leaf. `orderChild` returns `{ ...child, order: stored }` whenever an entry exists, even when `child.order` already equals it (deep-equal, or the same array). That sets `changed` and returns a new group, against the documented "Any subtree the order leaves as it was comes back as the same object". `PrefsBar` calls `orderPrefGroup` on every render (PrefsBar.tsx:73, 80), so every memo keyed on the group misses on each render while a bar has a stored action order.
- evidence: read
- severity: low

## Files read
packages/prefs/src/KitSettingsFromPrefs.tsx
packages/prefs/src/aliasTargets.ts
packages/prefs/src/autoReset.ts
packages/prefs/src/blend.ts
packages/prefs/src/conditionCheck.ts
packages/prefs/src/css.ts
packages/prefs/src/defaultsSource.ts
packages/prefs/src/edit.entry.ts
packages/prefs/src/heading.ts
packages/prefs/src/hooks.ts
packages/prefs/src/hostAttributes.ts
packages/prefs/src/index.ts
packages/prefs/src/kinds.ts
packages/prefs/src/kitCss.ts
packages/prefs/src/merge.ts
packages/prefs/src/migrate.ts
packages/prefs/src/open.ts
packages/prefs/src/order.ts
packages/prefs/src/pair.ts
packages/prefs/src/react.ts
packages/prefs/src/scopedUnit.ts
packages/prefs/src/snapshot.ts
packages/prefs/src/sources/policy.ts
packages/prefs/src/sources/prefsSource.ts
packages/prefs/src/sources/selectionSource.ts
packages/prefs/src/sources/valuesSource.ts
packages/prefs/src/splitCheck.ts
packages/prefs/src/stamp.ts
packages/prefs/src/store.ts
packages/prefs/src/storeWrites.ts
packages/prefs/src/tabRuns.ts
packages/prefs/src/tags.ts
packages/prefs/src/testing/editAssetSet.ts
packages/prefs/src/type.ts
packages/prefs/src/usePrefsStore.ts
packages/prefs/src/vite.ts
packages/prefs/src/weightAxes.ts

<!-- done: 7 findings, files read: 37 -->
