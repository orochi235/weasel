---
"@weasel-js/ui": patch
"@weasel-js/ui-logic": patch
---

`domFocusScope`'s `moveFocus` passes over an element that will not take focus and returns the one that did, or null, so it always agrees with `focused`.
