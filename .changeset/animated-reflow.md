---
"@weasel-js/core": patch
---

Layout reflow can animate. `useAnimatedReflow(scene, animator, { ms, easing } | { spring })` returns a `ReflowTransition`; pass it to `<SceneCanvas reflowTransition>` (or set `LayoutDep.reflow`) and the siblings a drag's layout reflow displaces glide to their slots through the animator instead of snapping. Each node's glide runs under the cancel-key `reflow:<id>`, so a new target mid-glide interrupts the old one and continues from the pose on screen; when a sibling stops reflowing, or the drag commits or cancels, it glides onto its document pose and its override is dropped. Glides are published through the scene's pose overrides, so the document and undo history are untouched. `null` turns it off. `createReflowTransition` is the non-hook form. Additive.
