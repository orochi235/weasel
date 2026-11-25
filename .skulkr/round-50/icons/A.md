Writing `.skulk/out/findings.md` was refused, so the whole document is below.

# Audit round 50: icons, blind reviewer findings

## A variant can load twice when a listener calls `loadVariant` during the `loading` notification
- where: packages/icons/src/variants.ts:38-51 (createVariants → load)
- scenario: `set(name, 'loading')` calls `changed()` (the registry's `bump`), which notifies listeners synchronously, before `pending.set(name, run)` runs. A subscriber that keeps a variant loaded, e.g. `r.subscribe(() => void r.loadVariant('all'))`, runs `load('all')` inside that notice. It finds a loader, a state of `loading` (not `loaded`) and no pending entry, so it starts a second run. The outer call then overwrites `pending` with its own run. The loader runs twice and the variant's tables are added twice: each namespace claim is counted twice, and every glyph is pushed twice. The doc promises "Loads each named variant at most once at a time". The settle path already handles this re-entrancy: it removes the run from `pending` before its notice. The start path should register `pending` before `set(name, 'loading')`.
- evidence: read (registry.reentrant.pbt.test.ts:261 only retries on `failed`, so it doesn't cover this path)
- severity: medium

## When the provider's `icons` change identity, its glyphs move to the end of `entries()`
- where: packages/icons/src/registry.ts:49 (createIconRegistry, `createReflectable` without `holdPlace`); packages/icons/src/react/IconRegistryProvider.tsx:28-35 (useOwnedRegistry)
- scenario: `<IconRegistryProvider icons={[ui, core]} variants={{ all }}>`. A new array literal on each render makes the effect release the old tables and then add the same tables back. The release deletes every key that only those tables hold, because the store runs without `holdPlace`. The re-add then puts those keys at the end of the Map. Once `all` has loaded, or an override-only ref exists, the base glyphs come after the variant's glyphs in `entries()`, and `useIconVariant(...).entries` (a picker's listing) reorders on unrelated parent renders. Registration order should survive a same-tick release and re-push. That is exactly the case `holdPlace` exists for: "as a React effect re-running does".
- evidence: read
- severity: low

## `toIconSpec` drops the whole spec when `mark` is `null`
- where: packages/icons/src/spec.ts:40-42 (toIconSpec)
- scenario: the JSON `{ "name": "ui:layer", "mark": null }` (a writer that serializes an absent mark as `null`) makes `mark !== undefined`, so `badge` is undefined and the function returns `undefined`. The field then reads as no icon at all, not as `{ name: 'ui:layer' }`. `null` is JSON's only way to spell "no mark", and this function exists to read specs "loaded as JSON".
- evidence: read
- severity: low

## `add` checks a table's shape but not its glyphs, so a null glyph is registered
- where: packages/icons/src/registry.ts:64-69, 83 (add)
- scenario: a variant module or a hand-loaded JSON table with `"icons": { "x": null }` passes the shape check (which refuses a bad table outright, before any claim). `glyphs.push('ns:x', null)` then registers it. `get('ns:x')` returns `null` where `IconGlyph | undefined` is typed, and `entries()` lists `{ glyph: null }`, so a picker that reads `entry.glyph.group` or `.body` throws. The batch should be refused the same way a non-object `icons` is.
- evidence: read
- severity: low

## Files read
packages/icons/src/icons.gen.ts
packages/icons/src/icons.table.ts
packages/icons/src/index.ts
packages/icons/src/mark.ts
packages/icons/src/names.ts
packages/icons/src/pbt.fixture.ts
packages/icons/src/react.ts
packages/icons/src/react/IconRegistryProvider.tsx
packages/icons/src/react/useIconGlyph.ts
packages/icons/src/react/useIconVariant.ts
packages/icons/src/registry.ts
packages/icons/src/shapes.ts
packages/icons/src/spec.ts
packages/icons/src/table.ts
packages/icons/src/variants.ts

<!-- done: 4 findings, files read: 15 -->