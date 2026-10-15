---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Bridge: `bridgePaths` ("Bridge", Mod+Shift+J) joins the nearest open ends of two selected paths with a curve that leaves each end along the direction its path was heading, each new handle `params.tension` times the gap long (default `DEFAULT_BRIDGE_TENSION`, 0.4; `0` is the straight segment Join makes). The two paths become one, the first selected keeping its style, as one undo step; with one path selected, Bridge closes it. In path edit, `bridgeAnchors` ("Bridge anchors", Mod+Shift+J) does the same for the two selected end anchors. Both are in the standard actions and the `paths` feature preset, and their `tension` param types through `ActionParamSchema`, so `<SceneCanvas tune>` reaches it. Underneath, `joinSubpathEnds` and `joinAnchorsAt` in `@weasel-js/geom` take an optional `JoinOptions` with that `tension`. Additive.
