---
'@weasel-js/ui': patch
---

`PrefsForm` draws a root `as: 'bar'` as that one bar, whatever `layout` says, and its new `orientation` prop says which way the bar runs. A drop over a bar's cell is placed by the half of the cell along the bar's axis, so `prefDropTargetAt` answers before or after a cell from left to right in a bar that runs across.

In `PrefSchemaEditor`, the live preview of a root drawn as a bar is now that form: a pref or an action can be dropped between its cells, a cell can be dragged to a new place (a button is picked up by a press on it), and a press on a cell selects its pref in the tree.

`Tree` has a `ghost` prop that turns off the dragged rows drawn beside the pointer. The schema editor's trees use it while the preview draws the dragged node where it would land.
