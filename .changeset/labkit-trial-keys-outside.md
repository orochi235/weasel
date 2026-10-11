---
'@weasel-js/labkit': patch
---

A trial's Mod+Z, Mod+Shift+Z, and Mod+S now work with focus outside every trial, such as on the page body after a click on empty space: they go to the focused trial, or to the first where none is focused. Before, the chords were heard only inside the trial's own section, so undo did nothing there while the toolbar's Undo button worked. A text field keeps its own undo wherever it is, and a slider or checkbox inside a trial still undoes the trial.
