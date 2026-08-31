---
'@weasel-js/text': patch
---

Reword the missing-bidi-engine warning so it no longer embeds a quoted
`import … from "@weasel-js/bidi"` statement. The guidance is unchanged; only
the phrasing is.

labkit's consumer smoke test greps its bundled `dist` for that exact shape to
prove the bundle is self-contained, and a string literal spelling it out was
indistinguishable from a real leaked specifier. The check had been failing
since the warning landed.
