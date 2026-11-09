---
"@weasel-js/svg": patch
---

An imported `<text>` without `xml:space="preserve"` now reads a newline in its content as a space, as browsers draw it, where it used to drop it and join the words on either side.
