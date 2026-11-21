---
'@weasel-js/ui': patch
---

A `Dialog` in a contained portal passes `ModalOverlay`'s `style`, `isEntering`, `isExiting` and DOM props to its overlay.

It warns about `onEnter`, `onExit`, `UNSTABLE_deferUntilEntered` and `render`, which it cannot honor.

<!-- entry: fix -->
