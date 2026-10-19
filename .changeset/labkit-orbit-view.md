---
'@weasel-js/labkit': patch
---

A trial now notices when it draws a 3D view with no camera. A 3D view draws through `useOrbitView()`, which returns the trial's orbit camera with a `viewportRef` for the pane the scene is drawn in; a three.js `WebGLRenderer` whose canvas sits in the trial's DOM counts too, found through three's `__THREE_DEVTOOLS__` announcement. If the instrument declares no `orbit`, so nothing labkit owns can turn, dolly, pan, or home that camera, the trial warns in development, once per instrument, and its title bar shows "no camera". Declaring `orbit` in any form ends it: `orbit: { fixed: true }` keeps the trial's camera but binds none of its gestures, and `orbit: false` says the instrument keeps a camera of its own. `useTrialOrbit()` is unchanged, and remains the reader for chrome.
