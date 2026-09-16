---
'@weasel-js/theme': patch
---

`serializeTokenValue` and `parseTokenValue` are public. A DTCG value is not
always a string — a `fontFamily` is a list of names and a `cubicBezier` is four
numbers — and the only code that knew how to render those was private to the
CSS emitter. Anything that shows a token value for editing had to fall back to
`JSON.stringify`, which puts `["Oswald","Helvetica Neue Condensed"]` in front of
a person and writes it back as the literal value.

`serializeTokenValue` is the emitter's own rendering (a quoted font stack, a
`cubic-bezier(…)`), and `parseTokenValue` is its inverse, so an edited value
returns to the shape the definition stores. `resolveTokens` now calls the
exported function rather than keeping its own copy.
