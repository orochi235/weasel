---
'@weasel-js/labkit': patch
---

`<Lab>` takes `pages` and `path`, forwarding both to the shell it already
renders. `<LabShell>` has had them all along — given two or more pages the title
becomes the switcher that reaches the project's other labs — but a lab built on
`<Lab>` had no way to pass them, so it could be reached from another lab's
switcher and offer no way back.
