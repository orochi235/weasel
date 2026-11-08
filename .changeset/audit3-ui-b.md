---
"@weasel-js/ui": patch
---

UI fixes from an audit:

- `Plot2D`'s pointer coordinates (`onPointerDown`, `clientToPlot`, `clientToModel`) map through the size the plot is drawn at, so a plot scaled by CSS no longer reports points off from the pointer.
- `Timeline` keeps its own key selection and zoom when given only `onSelect` or `onWindowChange` to listen with; either used to replace the internal state, so selecting and zooming did nothing.
- Delete or Backspace on a `Timeline` key removes that key, not whichever key was selected, and on an event mark removes nothing.
- `ResizeHandle`'s Home and End give the pane its smallest and largest size with `invert` too; inverted, they were swapped.
