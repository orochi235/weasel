## decodeEntities throws a bare RangeError on an out-of-range numeric reference instead of its own named error
- where: apps/theme-editor/scripts/brand-colors.mjs:49 (decodeEntities)
- scenario: a title holding `&#0;`-style surrogates or a reference past U+10FFFF (e.g. `&#x110000;` or `&#99999999;`) → `String.fromCodePoint` throws `RangeError: Invalid code point`, with no mention of the generator or the offending text, whereas every other unexpected reference throws `gen-brand-colors: no decoding for … in …`; HTML itself maps such references to U+FFFD rather than failing
- evidence: read
- severity: low
- size: line
- cause: unchecked code point range
- confidence: sure

## decodeEntities matches named references case-insensitively but looks them up case-sensitively
- where: apps/theme-editor/scripts/brand-colors.mjs:47-51 (decodeEntities)
- scenario: Brickset markup containing `&AMP;`, `&QUOT;`, `&LT;` or `&GT;` (all valid HTML named references) → the `/i` regex captures `AMP`, `Object.hasOwn(NAMED, 'AMP')` is false, and the whole generator throws `no decoding for &AMP;`, though the table knows the entity
- evidence: read
- severity: low
- size: line
- cause: NAMED keys only lowercase
- confidence: sure

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/brand-colors.d.mts
apps/theme-editor/scripts/brand-colors.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 2 findings, files read: 5 -->
