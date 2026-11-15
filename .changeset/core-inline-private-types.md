---
'@weasel-js/core': patch
---

Declarations that named a type core does not export now write out its shape or name a public type instead.

Rectangles in `regionAround`, `readGl`, `CanvasReader`, `textFrameOf` and `LeaveGroupOptions.boxOf` are `@weasel-js/geom`'s `Rect`; `nestedHitTester`, `SceneCanvasAdapter`, `paintAbove`, `withInheritedPaints`, `nodeFrameOf`, `SetDependsOnArgs`, `UseSceneOptions`, `useEditAnchorsDepSource` and the clipboard's JSON replacer and reviver options spell their shapes out in place. No shape changed.

<!-- entry: fix -->
