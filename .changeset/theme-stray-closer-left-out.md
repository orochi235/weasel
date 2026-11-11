---
"@weasel-js/theme": patch
---

`applyTheme` leaves out, with a warning, a token value with a `)` or `]` that closes nothing, which the browser would drop as invalid.

<!-- entry: rank=-5 fix -->
