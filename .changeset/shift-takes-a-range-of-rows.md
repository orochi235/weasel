---
'@weasel-js/ui': patch
---

A press on a row with Shift held reports a range. `PrefSelectHow` gains `range`, which adds API: the rows the form or panel draws from the first selected path to the one pressed, in that order, with the pressed one last. `PrefsForm` and `SelectionPanel` both report it through `onSelect`, and it is absent when Cmd, Ctrl, or Alt is held too, when nothing is selected, or when the first selected path is not drawn, as on another rail page; the press is then a plain pick.

`PrefSchemaEditor`'s live preview takes that range as its selection, where Shift used to do nothing there. The range runs over what the preview draws, so it never crosses a page, and the first selected node stays the end the next range runs from. Made on an agent's judgment.
