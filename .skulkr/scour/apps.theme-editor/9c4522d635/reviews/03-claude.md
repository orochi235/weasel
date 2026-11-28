## decodeEntities throws a bare RangeError on an out-of-range numeric reference
- where: apps/theme-editor/scripts/brand-colors.mjs:49 (decodeEntities)
- scenario: a title containing `&#x110000;` or `&#99999999;` (or a surrogate like `&#xD800;`, which decodes to a lone surrogate) → `String.fromCodePoint` throws `RangeError: Invalid code point` with no context naming the source text, unlike the named-reference path, which throws a `gen-brand-colors:` error quoting the text; a lone surrogate is written into the generated file silently
- evidence: read
- severity: low
- fix: apps/theme-editor/scripts/brand-colors.mjs
- size: line
- cause: numeric reference not range-checked
- confidence: sure

## The second palette write can fail after the first has landed, despite the comment promising both or neither
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:33 (top level)
- scenario: `writeFileSync(PALETTE_FILES.lego, …)` succeeds, then the Copic write fails (permission, disk full) → legoColors.ts is new and copicColors.ts old; the comment "a failure leaves both files as they were" covers only render failures
- evidence: read
- severity: low
- fix: apps/theme-editor/scripts/gen-brand-colors.mjs
- size: line
- cause: non-atomic paired writes
- confidence: sure

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/brand-colors.d.mts
apps/theme-editor/scripts/brand-colors.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts
<!-- done: 2 findings, files read: 5 -->
