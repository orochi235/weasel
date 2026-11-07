---
'@weasel-js/core': patch
---

`useEnteredGroup(scene)` now returns the scene's one entered group, the same store from every component that calls it, so two components on one scene no longer disagree on which group is entered. A `<SceneCanvas>` given no `enteredGroup` uses that same store, so a component outside the canvas can read and drive the canvas's entered group with `useEnteredGroup(scene)` without passing it in. This changes behavior for a caller that counted on a private store per call: use `createEnteredGroup(scene)` for a separate one, and pass it as `<SceneCanvas enteredGroup>`.
