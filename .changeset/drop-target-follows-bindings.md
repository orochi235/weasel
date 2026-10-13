---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fixes: a canvas with no binding for a drop was still a drop target. An OS drag over a `<SceneCanvas>` without the `ingest` preset showed the copy cursor and the `weasel-dropover` class, and the drop was swallowed with nothing inserted. `useGestureDispatcher` now asks its bindings on each `dragover` whether one would take a drop of what the drag carries, and only then cancels the event and adds the class. A drag nothing would take is left to the page.

This is a behavior change, decided on an agent's judgment: the question is answered per drag, by the bindings, with no new channel flag. A consumer's own `drop` binding makes the canvas a drop target without the `ingest` preset, and a binding typed `drop(image/*)` refuses a drag of plain text. A file whose type the browser withholds until the drop (Firefox names it `application/x-moz-file`) is accepted while it hovers.

Adds API: `UNKNOWN_MIME` in `@weasel-js/gestures`, the MIME of an item whose type is not known yet, which `matchIngestTypes` lets through every glob; and `itemTypesFromDataTransfer` in `@weasel-js/routing`, what a drag in flight says it carries.

Changes API: `SceneCanvasApi.ingest()` returns a boolean, where it returned nothing. `false` means the canvas had no `ingest` action to run, which was a silent no-op before; it also warns under the `ingest` debug namespace.
