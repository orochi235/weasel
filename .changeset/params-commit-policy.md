---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

When an edit is written is said in one table. `@weasel-js/ui` gains `PARAMS_SETTLES`, `withCommitPolicy`, and the `ParamsSurface` type, which adds API: for a form, a panel, and a lab, whether a typed number, a slider, text, and a color write only the value an edit settles on. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` apply it, where the first two each withheld `onInput` by hand. No surface writes at a different time than it did.
