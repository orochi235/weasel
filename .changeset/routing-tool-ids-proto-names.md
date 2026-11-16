---
'@weasel-js/routing': patch
---

Tool ids, option keys and pref path segments named `__proto__` or `constructor` are read as their own entries, never as built-ins.

`toolOptionsPrefs`, `toolShortcutsOf`, `declaredToolShortcuts` and `useTools` keep a tool named `__proto__` as an entry, and `heldModifierOf('constructor')` is `null`.

<!-- entry: fix -->
