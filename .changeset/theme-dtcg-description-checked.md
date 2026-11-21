---
'@weasel-js/theme': patch
---

`fromDtcg` refuses a token whose `$description` is not a string, naming the token, where emitting the theme's CSS later threw.

<!-- entry: fix -->
