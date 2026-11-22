## `override` registers a glyph without the shape check `add` applies to every table glyph
- where: packages/icons/src/registry.ts:116 (createIconRegistry, `override`)
- scenario: `add` refuses with a `TypeError` any glyph lacking a string `body` and `group`, an array of `tags`, and a string-or-absent `fill` (`isGlyph`, lines 47-51, 76-80; ruled in docs/unruled.md:1543-1546). `override` pushes its `glyph` straight into the store with no check. A caller overriding from data read at run time (a theme or plugin's JSON, `registry.override(toIconRef(k)!, json[k])`) with `{ body: 42 }` or `{ path: "…" }` gets it registered: `get(ref)` and `entries()` then hand renderers a glyph whose `body` is not a string, and every reader of that ref breaks downstream instead of the registry refusing at the call. The same question — is this value a glyph — is answered two ways on the registry's two write paths; `override` should run `isGlyph` and throw the same `TypeError`.
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

<!-- done: 1 findings, files read: 15 -->
