---
'@weasel-js/core': patch
---

`useAnimatedReflow` / `createReflowTransition`: a glide canceled through the animator (`cancelKey('reflow:<id>')`, `cancelAll()`) left the node frozen partway, and asking again for the same `glide` target or `settle` did nothing. Asking again now restarts it from where it stopped.
