---
'@weasel-js/prefs': patch
---

A number split by a selector and read under `weights` blends to a value between its members, whatever the weights: a weight near the double range no longer overflows the blend to `Infinity` or `NaN`, and equal members read as themselves rather than off by an ulp.
