---
'@weasel-js/ui': patch
---

`ItemList`, `LayerList`, and `Tree` now share one keyboard model for their rows, so they agree where they used to differ:

- Alt+Up/Down nudges a row only with neither Ctrl nor Cmd held.
- A plain arrow move re-anchors the next Shift range in `Tree`, as it already did in the other two, and the first row focused anchors when nothing has.
- Shift with Left or Right in `LayerList` moves focus without extending the selection, as in `Tree`.
- When the focused row of a `LayerList` is removed, focus goes to its next sibling, else the row above, rather than to whatever row slid into its place.
- A keyboard move that the consumer never renders no longer pulls focus back on a later render, in `ItemList` and `LayerList` as in `Tree`.
