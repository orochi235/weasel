---
'@weasel-js/diagram': minor
---

Diagram bodies, labels and sequences committed while their face was still loading can be measured again once it lands.

`useFaceRemeasure(scene, { measure })` does it for the life of a component, `installFaceRemeasure` returns the unsubscribe, and `remeasureText` runs it once. A body grows to what its rows need and never shrinks; the writes are untracked, so undo never brings back a size measured in the wrong face.

<!-- entry: new api -->
