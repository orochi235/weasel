---
"@weasel-js/theme": patch
---

`applyTheme` leaves out, and warns about, a token value with a `)` or `]` that closes nothing, such as `serif)`. A custom property holding one is invalid, so the browser dropped the declaration without a word; the value used to be written as if it would hold.
