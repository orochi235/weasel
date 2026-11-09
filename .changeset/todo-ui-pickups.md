---
'@weasel-js/ui': patch
---

Curved rows and sliders follow the screen and their shape, and an empty fragment takes a drop in a live preview.

- The arrow keys on a segmented row (`ToggleBar`, `ButtonBar`, `OptionsBar`) laid along a curve that runs right to left on screen, such as a clockwise bottom arc, follow the screen: Right moves to the segment on the right. So does Alt+Right reordering a `Bar` along one. A roving container's `onKeyDown` takes the direction its items run across the screen as a second argument.
- A `Slider` along a curve runs its values along the shape, min at its start, as a row along it lays its items, so a counterclockwise arc reads as a counterclockwise dial. Before, values ran left to right whatever the shape's direction. Where its values run right to left on screen, ArrowRight steps down.
- An empty fragment in a `PrefsForm` draws a slot a row high while a drag is over the form (`drop` set), so a drop can land in it; the rows after it move down for it. `PrefSchemaEditor`'s preview tells the form a drag is on for a new node from the palette too, which it did not while that node had nowhere to land.
