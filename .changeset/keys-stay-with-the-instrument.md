---
'@weasel-js/routing': patch
'@weasel-js/labkit': patch
---

Keys go where a press or a scroll landed, not to whichever dispatcher heard it last. A dispatcher with
`keyboard: false` no longer takes the keys when pressed or scrolled in, since it can do nothing with them; and of
two nested surfaces, the innermost one the event landed in takes them, though the wheel listens in the capture
phase. A context menu still activates its own scope.

labkit's trial cameras (`Orbit`, `CameraInput`) bind no keys and now say so, so a click in an instrument that
runs its own dispatcher no longer hands its keys to the camera around it: undo, delete, and select all work in the
3D lab again. The minimap, lens, and trial overview, already `keyboard: false`, stop taking the keys from the canvas
beside them when clicked.
