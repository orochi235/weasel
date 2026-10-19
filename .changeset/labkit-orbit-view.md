---
'@weasel-js/labkit': patch
---

A 3D view in a trial now draws through `useOrbitView()`: it returns the trial's orbit camera with a `viewportRef` for the pane the scene is drawn in, and tells the trial a 3D view is there. A trial whose instrument draws one but declares no `orbit` — so nothing can turn, dolly, pan, or home its camera — warns in development, once per instrument. `OrbitCapability.fixed` is the opt-out: the trial binds none of the camera's gestures, and the camera stays the trial's, persisted, cloned, and reset. `useTrialOrbit()` is unchanged, and remains the reader for chrome.
