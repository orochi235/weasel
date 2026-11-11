---
"@weasel-js/modes": patch
---

A listener subscribed both to a mode registry and to a `createScopingDim` or `createModeDecorations` built on it keeps each subscription when it leaves the other. Leaving one dropped its registry subscription too, so it stopped hearing mode changes. It now hears a mode change from each of them it is on.
