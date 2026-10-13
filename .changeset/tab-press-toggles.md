---
'@weasel-js/ui': patch
---

Fixes: Cmd or Ctrl on a press of a tab toggles it in the selection, and Shift extends to it, in `PrefsForm` and `SelectionPanel`. A react-aria tab keeps its pointer events, so the press reached `onSelect` only as the focus it caused, as a plain pick, and a press of a tab that already held focus reported nothing.
