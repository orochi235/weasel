---
'@weasel-js/ui': patch
---

Curved rows follow the screen.

- The arrow keys on a segmented row (`ToggleBar`, `ButtonBar`, `OptionsBar`) laid along a curve that runs right to left on screen, such as a clockwise bottom arc, follow the screen: Right moves to the segment on the right. So does Alt+Right reordering a `Bar` along one. A roving container's `onKeyDown` takes the direction its items run across the screen as a second argument, and `useBarReorderKeys` a `dir`.
