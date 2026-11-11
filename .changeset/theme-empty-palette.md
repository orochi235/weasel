---
"@weasel-js/theme": patch
---

`generate` draws an empty palette for a count of 0, and a categorical ramp with no steps derives to no tokens. Both used to throw `not a hex color: "undefined"`.
