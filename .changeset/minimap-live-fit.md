---
'@weasel-js/minimap': patch
---

A minimap can frame the poses being shown. `fit: 'live'` is a new value of `MinimapFit`, accepted by `<MinimapCanvas>`, `createMinimapContribution`, and `computeFitView`: it fits the union of leaf poses with `scene.overrides` applied, and refits whenever an override publishes, so the frame follows a drag, a settle, or a simulation that writes overrides. `'scene'` stays the default and still frames document poses, which holds the frame still through a gesture. A live fit sweeps every leaf on each override publish and rescales the whole minimap while a node moves past its edge. Added on an agent's judgment.
