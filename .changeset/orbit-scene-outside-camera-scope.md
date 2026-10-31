---
'@weasel-js/labkit': patch
---

An orbit trial's scene now renders outside the orbit camera's input scope. A `<SceneCanvas>` drawn in an orbit instrument's DOM — a node diagram beside the 3D pane, say — no longer hears the camera's bindings beside its own: it logged a route conflict for every gesture on load, and a drag or wheel on the canvas moved the 3D camera.
