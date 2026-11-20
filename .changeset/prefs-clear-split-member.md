---
'@weasel-js/prefs': patch
---

Writing `undefined` to a split pref clears only the option the write names, or the current one, and leaves every other option's value.

<!-- entry: fix -->
