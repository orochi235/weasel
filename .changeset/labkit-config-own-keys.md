---
"@weasel-js/labkit": patch
---

A config key every object has, `__proto__`, `constructor`, or `toString`, now works like any other. A schema keyed `__proto__` lost that node from its defaults, its resolved tree, and its trip through `prefsFromConfig` and `f.prefs`, and a seed config parsed with that key set the trial's prototype. A leaf keyed `toString` or `constructor` was drawn by `Object.prototype`'s function as though it had a renderer of its own, a hidden one in a group's section showed up in the settings rail as that function, and a mark depending on such a key went stale though it never recorded the key.

The settings rail no longer loses a root setting whose key matches a root section's name, like a `grid` setting beside a `Grid` section: the section takes another key.
