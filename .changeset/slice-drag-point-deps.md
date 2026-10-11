---
'@weasel-js/core': patch
---

The slice tool's drag-to-place-a-point read the view and the `slice` dep from the gesture's end context, which carries none: a drag released on the first point of a pending cut did not close and commit it, and the placed point was measured at 1:1 zoom. It now uses the deps the drag started with.
