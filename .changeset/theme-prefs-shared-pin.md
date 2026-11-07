---
'@weasel-js/theme': patch
---

`themePrefsPins` and `themeFromPrefs` keep a split pref's shared value: after a plain value is set and then one mode is given its own, every other mode pins the shared value instead of falling back to the base theme.
