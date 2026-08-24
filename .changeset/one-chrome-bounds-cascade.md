---
'@weasel-js/core': patch
---

Resolve selection chrome's bounds through one cascade, not two.

`createSelectionOverlayLayer`'s `getPose` is now optional alongside
`getSelection`. Omitted, the layer takes bounds from the `ChromeState` on the
draw envelope — the cascade its selection was already built with. `<Canvas>`
and `<SceneCanvas>` each carried a `poseById` chain of their own for this;
both are gone, and a consumer's `poseById` override still wins where it is set.

The two chains were supposed to agree and did not: they consulted the same
preview sources in opposite priority, and only one of them carried rotation
through. With one camera the disagreement was hard to see; per-view chrome
would have made it visible.
