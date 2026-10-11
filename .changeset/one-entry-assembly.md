---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Tool overlays follow the entry assembly the dispatcher routes by. With two tools held by hotkey, their overlays now stack newest hold first, as their bindings do, and under a `modes` registry a tool the active mode bars stops drawing its overlay as well as losing its bindings. `assembleEntries` is the one function behind both and is exported. `ContributionsApi.scopedBindings()` is removed, a breaking change for a caller of it: nothing in the kit called it, and it answered in a different order with no capability gate. `scopeBindings(assembleEntries(...))` gives the bindings the dispatcher sees.
