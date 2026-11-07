---
"@weasel-js/routing": patch
---

A key or a paste typed inside an open modal dialog no longer reaches a canvas behind it: a dialog with `aria-modal="true"`, a `<dialog>` opened with `showModal()`, or a dialog that has made the canvas inert or `aria-hidden`, as React Aria's modal dialogs do. Backspace on a button in a dialog no longer deletes the selection behind it. A canvas inside the dialog keeps its keys.
