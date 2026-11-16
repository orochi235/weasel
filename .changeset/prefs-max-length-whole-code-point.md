---
'@weasel-js/prefs': patch
---

A stored string longer than its pref's `maxLength` reads cut before an emoji that straddles the limit rather than through the middle of it.

<!-- entry: fix -->
