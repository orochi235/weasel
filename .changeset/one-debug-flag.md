---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The `weasel.debug` flag is read and cached once. `@weasel-js/routing` now exports `isDebugEnabled` and `dwarn` beside `dlog`, and `@weasel-js/core` and `@weasel-js/ui` export those same functions where each used to parse `localStorage` with its own copy of the code. `@weasel-js/ui`'s `isDebugEnabled` now also takes no argument, to ask whether any namespace is on.
