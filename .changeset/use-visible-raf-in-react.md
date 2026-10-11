---
'@weasel-js/react': patch
'@weasel-js/core': patch
---

react: `useVisibleRaf` lives here now, with its `VisibleRaf`, `VisibleRafOptions`, and `VisibleRafTarget` types, so a package below core can run a frame loop behind the visibility gate. `@weasel-js/core` still exports all four.
