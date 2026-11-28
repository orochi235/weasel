## The script still writes one file and not the other when the second write fails
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:34 (top level)
- scenario: Both tables render before anything is written, so a parse failure leaves both files untouched, as the comment promises. But if the second `writeFileSync` throws (EACCES, ENOSPC, a missing `src/palette` dir), `legoColors.ts` has already been replaced and `copicColors.ts` has not. A crash partway through a write can also leave a truncated `.ts` file. It should write each file to a temp file and rename it into place only after both temp writes succeed.
- evidence: read
- severity: low
- size: function
- cause: non-atomic sequential writes
- confidence: sure

## A numeric reference past U+10FFFF throws a bare RangeError instead of the script's own error
- where: apps/theme-editor/scripts/brand-colors.mjs:51 (decodeEntities)
- scenario: For a title such as `&#x110000;` or `&#99999999;`, `String.fromCodePoint` throws `RangeError: Invalid code point`. That message names neither the reference nor the text it came from, which the named-reference branch does name. Only malformed upstream HTML reaches this.
- evidence: read
- severity: low
- size: line
- cause: unchecked code point range
- confidence: sure

## The upstream fetches have no timeout, so the generator can hang forever
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:20 (get)
- scenario: If brickset.com or raw.githubusercontent.com accepts the connection but never answers (tarpit, stalled proxy), `fetch` never settles and the script hangs with no message. `AbortSignal.timeout(...)` would make it fail with a clear error.
- evidence: read
- severity: low
- size: line
- cause: no abort signal on fetch
- confidence: sure

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/brand-colors.d.mts
apps/theme-editor/scripts/brand-colors.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 3 findings, files read: 5 -->
