---
'@weasel-js/ui': patch
---

Adds API: a `PrefRenderer` may set `wide`, beside `group`, to ask `PrefsForm` for the row's whole width with its label above the control, in a row of the form and in a field of an object leaf. It is the row a `map` or a `union` already gets, and the control is stretched to it. `PrefSchemaEditor` asks for it for "Shown if" and "Enabled if", so a test's pref, comparison, and value share a line once the attributes pane is about 440px wide, where they wrapped to three lines in the control column at any width.
