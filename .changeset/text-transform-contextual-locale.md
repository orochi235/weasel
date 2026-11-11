---
"@weasel-js/text": patch
---

`textTransform` follows a locale's contextual case rules inside a run.

Under `lang: 'tr'` a lowercased `I` with a combining dot draws `i`, not a dotless `ı` under the dot, and under `lang: 'el'` an uppercased letter drops its combining accent. The dropped mark's source joins the letter before it in the run's source map, so carets and selections step over both.

<!-- entry: fix -->
