---
'@weasel-js/theme': patch
---

`fromDtcg` refuses a document that is not an object, such as JSON `null`, with the error it gives one with no name.

<!-- entry: fix -->
