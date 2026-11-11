---
"@weasel-js/ui": patch
"@weasel-js/registry": patch
---

`ToolbarDock` keeps a dock or a bar whose id is `__proto__` as its own entry in the layout; it used to set the layout's prototype and lose the bar. A move into a dock at row -1 lands in its first row instead of throwing when the dock is empty. `@weasel-js/registry` exports `setOwn`, which sets a key as an own property, and prefs' `setOwnPrefValue` and labkit's `setOwn` now run through it.
