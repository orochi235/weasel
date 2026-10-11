---
'@weasel-js/core': patch
---

`insert.adjustRotation` turns only the insert drag in its own input scope. The gesture in flight was held in a module variable, so with two canvases a Shift+wheel routed in one rotated a shape being dragged out in the other. It is now held on a new `insertLive` dep that `<SceneCanvas>` sources per canvas; a host that registers the insert actions without `<SceneCanvas>` sources `insertLive` itself to get the rotation.
