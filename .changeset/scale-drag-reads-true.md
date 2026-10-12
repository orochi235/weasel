---
'@weasel-js/ui': patch
---

Fixes: on a `TokenPanel` scale, dragging a step's thumb away and back in one drag read one unit off near where it started (17 or 15 for a step at 16) and stopped updating exactly there. The readout is now the amount under the pointer all the way through.

Fixes: `Slider` kept calling the `onInput` and `onChange` it was given when a drag began, so a handler that closed over state saw the state from pointerdown for the whole drag. A drag now calls the handlers of the latest render.

Adds API: `Slider`'s `keyStep(thumb, steps, index)` prop takes over the arrow and Page keys, for a track whose values are not what the user counts in. It returns where a thumb lands `steps` key presses away (1 for an arrow, 10 with shift or for a Page key, negative toward `min`); the result is still held to the track, the thumb's bounds, and `constraint`. Home and End are unchanged.

Changes behavior: on a `TokenPanel` scale, shift with an arrow key, and Page Up and Page Down, now move a step by ten of the scale's smallest unit. They used to move it one hundredth of an octave along the track, which for a small step rounds to one unit, the same as a bare arrow key.
