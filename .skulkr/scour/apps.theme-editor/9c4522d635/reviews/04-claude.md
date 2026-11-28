## The generator's "a failure leaves both files as they were" guarantee doesn't cover a failed write
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:33 (top level)
- scenario: `writeFileSync(PALETTE_FILES.lego, …)` succeeds, then the copic write throws (EACCES, ENOSPC, or the file is locked by an editor). legoColors.ts is now regenerated and copicColors.ts is stale, which contradicts the comment. `writeFileSync` also isn't atomic: an interrupted write leaves a truncated .ts file.
- evidence: read
- severity: low
- size: function
- cause: non-atomic sequential writes
- confidence: sure

## parseCopic drops a marker whose `number` is numeric 0, and keeps duplicate codes
- where: apps/theme-editor/scripts/brand-colors.mjs:96 (parseCopic)
- scenario: the filter `c.extractedColor && c.number` treats a JSON `"number": 0` as missing, so the row is dropped without a word, though `String(c.number)` would handle it. Codes are never deduplicated (unlike parseLego's names), so if upstream repeats an entry, two rows with the same code get written. A code is the swatch's identity, so the repeat would show up as a duplicate swatch or key.
- evidence: read (the upstream data's shape was not checked)
- severity: low
- size: line
- cause: truthiness test on a field that can be 0; no dedupe
- confidence: likely

## A brickset rgb channel over 255 produces a malformed hex that still gets written
- where: apps/theme-editor/scripts/brand-colors.mjs:13 (hex2) / :71 (parseLego)
- scenario: `background-color:rgb(256,…)` makes `hex2` return `"100"`, giving a 7+-digit "#…" string. `oklab` reads the wrong slices and the row is written to legoColors.ts as an invalid colour. parseCopic validates `#rrggbb` and throws, but parseLego has no such check, so the two parsers answer "is this a valid hex" differently.
- evidence: read
- severity: low
- size: line
- cause: unvalidated channel range
- confidence: sure

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/brand-colors.d.mts
apps/theme-editor/scripts/brand-colors.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 3 findings, files read: 5 -->
