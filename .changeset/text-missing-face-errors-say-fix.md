---
'@weasel-js/text': patch
'@weasel-js/text-shaping': patch
'@weasel-js/font': patch
---

Errors about a face or engine that cannot serve text now say what to do about it.

A fallback face with no outlines is named with the call that registers it, a failed outline load points at its logged reason, a bad shaping feature shows the forms it takes, and `enableLocalFontOutlines` names `canQueryLocalFonts()`.

<!-- entry: fix -->
