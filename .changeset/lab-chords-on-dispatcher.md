---
'@weasel-js/labkit': minor
---

A trial's Undo, Redo and snapshot keys leave the key to an open menu, a modal dialog, or a focused widget that takes it.

They are the lab's `lab.undo`, `lab.redo` and `lab.snapshot` actions.

A `<TrialChrome>` answers them only under a `<Lab>`, whose key dispatcher hears them; a lab with no trials answers Mod+Z and Shift+Mod+Z the same way.

<!-- entry: api behavior -->
