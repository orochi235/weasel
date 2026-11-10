---
"@weasel-js/text": patch
---

`textTransform` follows a locale's contextual case rules inside a run: under `lang: 'tr'` a lowercased `I` with a combining dot draws `i` rather than a dotless `ı` with the dot still over it, and under `lang: 'el'` an uppercased letter drops its combining accent. Before, any such mapping sent the whole paragraph to code-point-by-code-point mapping, which ignores context. The dropped mark's source joins the letter before it in the run's source map, so carets and selections still step over both.
