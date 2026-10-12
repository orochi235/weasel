---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`@weasel-js/prefs` gains `pairRuns`, which turns a run of neighboring items into the rows they draw: each leaf a `pair` names joins the row of the leaf naming it, and a row left with one leaf is no pair. This adds API. `SelectionPanel`, a `Bar`, an object leaf's fields, and labkit's `ControlPanel` all walk it now, where each merged pairs itself and they disagreed about a pair with one leaf left.

That changes what a lone paired leaf draws. It is a row of its own under its own name, where a `SelectionPanel` row and labkit's `ControlPanel` used to label it with the pair's label, and a lone `toggle` boolean is a switch, where an object leaf or a multi-kind selection that kept half a pair used to draw a flag bar of one segment. `effectiveSections` pairs again after it intersects the kinds selected.
