---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A lab has a second pane region, `aside`, which holds sidebar sections on the far
side of the workspace from the sidebar, with its own resizable seam, width and
fold state. `LabAsideRegion` mounts it under a bare `LabShell`. `Split` takes
`side: 'end'` to put its sidebar after the content.

forge's CSS Vars panel moves out of each trial and into the lab's aside, where
it shows the focused trial and names it.
