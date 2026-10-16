---
'@weasel-js/forge': patch
---

The CSS Vars panel's Story tab lists only the variables the story uses: those read by a rule that matches an element in it or by its inline styles, and every variable those read in turn through a definition that reaches it. Before, it listed every `var()` in every stylesheet the document had loaded, the whole of weasel-ui's included. A checkbox, "Show variables the story doesn't use", brings the rest back. Each `CssVarReport` carries the answer as `used`.
