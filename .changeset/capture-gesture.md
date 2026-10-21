---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

`captureGesture` captures the next click, double click, drag, right click or keystroke as a gesture
spec, for a binding editor that rebinds pointer input as well as keys. It tells a click from a drag
with the dispatcher's own recognizer and drag threshold, writes the platform's primary modifier as
`mod`, and takes every event of what it captures from the page; Escape or an abort resolves `null`.
`captureKey` is now `captureGesture` limited to a keystroke.
