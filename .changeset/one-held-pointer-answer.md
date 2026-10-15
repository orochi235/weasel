---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/react': patch
---

One answer to "is a pointer held on this canvas". `heldPointers(element)` is new in `@weasel-js/gestures` (additive): it counts the pointers pressed on an element with any button and not yet released, and every reader of one element shares its listeners. The dispatcher's `hover` gesture and hover cursor, a layer's `onUncapturedMove`, and the `pointer` dep's published position all read it, where each used to track a press its own way.

What changes: a move with a secondary or middle button held is no longer a `hover`; `onUncapturedMove` stays off until the last of several pointers is released, and through a `pointerleave` mid-press; and the `pointer` dep no longer reports a position for a drag that began outside the canvas and passed over the page.

`giveKeys` (`@weasel-js/react/testing/giveKeys`) releases the middle-button press it makes.
