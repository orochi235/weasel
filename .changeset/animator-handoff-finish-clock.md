---
'@weasel-js/animator': patch
---

A run handed to the compositor ended at its destination whenever the browser animation finished, even where the animator's own clock was short of the end, as after time hidden, which the browser counts and the animator does not. It now ends by its own clock and places the browser animation back where that clock stands. Reversed between the browser finishing it and the frame that follows, it no longer jumps to its start.
