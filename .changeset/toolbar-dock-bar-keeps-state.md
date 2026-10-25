---
'@weasel-js/ui': patch
---

A bar torn off a `ToolbarDock`, floated, or docked again keeps its state: a menu open in it stays open, and a draft
typed into one of its fields survives the move. Each bar is now rendered once, into an element the dock moves from
slot to slot, where it used to remount in the floating layer. A dock's slot holds that element, marked
`data-dock-host`, rather than the bar's own markup.
