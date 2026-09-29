---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

The slice tool moves into the kit as `useSliceTool`, and cuts click by click. Clicks place the cut one point at a time, with a live preview trailing to the pointer; Enter or a double-click cuts, Escape discards, Backspace takes back the last point, and a click on the first point closes the cut into a loop and cuts. A drag still cuts straight, and an Alt-drag along its trail. The tool registers `sliceAction` itself, so a consumer passes it `tools={{ slice }}` and publishes a `slice` dep, and no longer needs `actions={{ slice: sliceAction }}`. Additive.

`splitPathByPolyline` now cuts out the region a loop in the cut encloses, instead of dropping the loop: a loop inside the fill becomes its own piece, taking any hole it surrounds, and leaves a hole in the piece around it. A closed cut counts as a loop, or, where it crosses the boundary, is cut as the chords it makes. A cut with a loop in it now returns one more piece than it did.
