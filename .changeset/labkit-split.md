---
'@weasel-js/labkit': patch
---

`Split` is the resizable two-pane strip a trial's sidebar sits in, exported from
`primitives` for any other box that wants one. `TrialBody` is now a thin wrapper
over it and renders the same DOM.
