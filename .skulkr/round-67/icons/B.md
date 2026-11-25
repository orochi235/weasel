# Audit round 67 — area `icons`

## A loader provided while its variant is `loading` is never run after that load fails, until a remount
- where: packages/icons/src/variants.ts:25 (createVariants → provide), packages/icons/src/react/useIconVariant.ts:18
- scenario: variant `all` is `loading` from loader A; `provideVariants({ all: B })` stores B but, per the 2026-11-20 ruling, leaves state `loading`. A then rejects → state `failed`, with B already in `loaders`. Nothing sets it `idle`: `provide` only reopens a `failed` name when the replacement arrives *after* the failure, and the mounted `useIconVariant` effect is keyed on `idle` (false → false), so it never re-asks. The variant stays `failed` with a fresh loader that never runs until some component remounts, whereas the same B handed over a moment later (after the failure) would be loaded at once. The ruling covers keeping B unrun while A is in flight, not abandoning B once A has failed; the settle step should reopen the name (`idle`) when the loader it ran is no longer the current one.
- evidence: read
- severity: low

## `override` accepts any value as a glyph, where `add` refuses one that is not a glyph
- where: packages/icons/src/registry.ts:116 (createIconRegistry → override)
- scenario: `add` validates every glyph with `isGlyph` and throws a `TypeError` on `{ body: 5 }` (ruled 2026-11-20). `registry.override('ui:x', { body: 5 } as any)` (a JS caller, or a glyph read from JSON) goes straight into `glyphs.push`; `get('ui:x')` then returns it and a renderer concatenating `body` draws `5`, or one with `tags` missing throws on `tags.map`. One registry answers "is this a glyph?" two ways depending on which door it came in by.
- evidence: read
- severity: low

## A provider's new `variants` value never drops a name the last one had
- where: packages/icons/src/react/IconRegistryProvider.tsx:36 (useOwnedRegistry), packages/icons/src/variants.ts:19 (provide)
- scenario: `<IconRegistryProvider variants={{ all, extra }}>` re-rendered with `variants={{ all }}`. `provide` only sets loaders from `next`; `extra` keeps its loader and state, so `useIconVariant('extra')` still reports `idle` and loads it, while `icons` on the same provider is documented as "a new value replaces the tables the last one registered". The prop's doc ("Variants a component may ask for by name") reads as the current set; the registry keeps the union of every value ever passed.
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

<!-- done: 3 findings, files read: 15 -->
