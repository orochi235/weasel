---
'@weasel-js/ui': patch
---

Curved rows follow the screen.

- The arrow keys on a segmented row (`ToggleBar`, `ButtonBar`, `OptionsBar`) laid along a curve that runs right to left on screen, such as a clockwise bottom arc, follow the screen: Right moves to the segment on the right. So does Alt+Right reordering a `Bar` along one. A roving container's `onKeyDown` takes the direction its items run across the screen as a second argument, and `useBarReorderKeys` a `dir`.
- A `Slider` along a curve runs its values along the shape, min at its start, as a row along it lays its items, so a counterclockwise arc reads as a counterclockwise dial. Before, values ran left to right whatever the shape's direction. Where its values run right to left on screen, ArrowRight steps down.
