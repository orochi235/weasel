---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

`SceneRegistry`, `DerivedDep`, `DerivePathFn` and `DerivePoseFn` take the scene's data and layer types after the pose (`SceneRegistry<TPose, TData, TLayer>`), defaulting to `unknown` and `string`. A `derivePath` or `derivePose` on a `Scene<MyData, MyLayer, MyPose>`, or in its registry, now reads its node's and its dependencies' `data` and `layer` typed instead of casting. `withKitRegistry` and `withDiagramRegistry` carry the same parameters through. Existing `SceneRegistry<TPose>` spellings are unchanged.
