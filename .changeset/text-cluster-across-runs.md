---
'@weasel-js/text': patch
---

A grapheme cluster split across two runs — a letter in one and its combining mark in the next — is now one cluster to layout: the caret no longer stops between the two, and `letterSpacing` tracks it once rather than once per side.
