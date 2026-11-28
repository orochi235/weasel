## decodeEntities matches named references case-insensitively but looks them up case-sensitively
- where: apps/theme-editor/scripts/brand-colors.mjs:47 (decodeEntities)
- scenario: a title attribute containing `&AMP;`, `&QUOT;`, `&LT;` or `&GT;` (all valid HTML named references) matches the `/gi` regex, misses `Object.hasOwn(NAMED, body)` because NAMED keys are lowercase, and the generator throws "no decoding for &AMP;", writing neither table; it should decode to `&` etc. (`&Nbsp;` and similar mixed-case forms are not valid HTML and could still throw.)
- evidence: read
- severity: low
- size: line
- cause: case-insensitive match, case-sensitive table
- confidence: sure

## An out-of-range numeric character reference throws a bare RangeError with no context
- where: apps/theme-editor/scripts/brand-colors.mjs:46 (decodeEntities)
- scenario: `&#x110000;` or `&#99999999;` in a Brickset title → `String.fromCodePoint` throws `RangeError: Invalid code point` with no mention of gen-brand-colors or the offending text. Every other failure path here names the input. HTML maps such references to U+FFFD.
- evidence: read
- severity: low
- size: line
- cause: unchecked code point range
- confidence: sure

## "A failure leaves both files as they were" does not hold for write failures
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:31 (top-level)
- scenario: rendering both tables before writing guards against parse failures only. If the second `writeFileSync` fails (EACCES, ENOSPC, or the process is killed between the writes), legoColors.ts holds the new table and copicColors.ts the old one, or a truncated file, because writeFileSync is not atomic. A write to a temp file followed by a rename for each table would make the comment true.
- evidence: read
- severity: low
- size: function
- cause: non-atomic sequential writes
- confidence: sure

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/brand-colors.d.mts
apps/theme-editor/scripts/brand-colors.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 3 findings, files read: 5 -->
