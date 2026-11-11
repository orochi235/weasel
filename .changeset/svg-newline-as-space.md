---
"@weasel-js/svg": patch
---

An imported `<text>` without `xml:space="preserve"` reads a newline as a space, as browsers draw it, rather than joining the words.

<!-- entry: fix -->
