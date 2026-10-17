---
'@weasel-js/ui': patch
---

The schema editor's icon picker takes Home and End, to the first and last icon, and PageUp and PageDown, a pane's height of rows at a time. Clicking an icon leaves focus on the grid, so the arrow keys go on working after a click. Across a selection whose icons differ it reads "Mixed" and marks no icon chosen, and a stored name that no registered table holds is marked "Not registered".
