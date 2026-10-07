---
'@weasel-js/core': patch
---

A concretely typed `Scene<MyData, MyLayer, MyPose>` is now assignable to `Scene<unknown, string, unknown>`, the type the `scene` dep and the built-in actions take, so passing one no longer needs `as unknown as`. The pose callbacks a scene carries — `clipFromPose`, `derivePath`, `derivePose`, on nodes, on `AddNodeSpec` and in `SceneRegistry` — are checked the way method parameters are, which is what had made every typed scene unassignable. A callback written against an unrelated pose type is still a type error where the scene is built; one that asks for a narrower pose than the scene's is no longer caught. The clip callback's type is exported as `ClipFromPoseFn`, beside `DerivePathFn` and `DerivePoseFn`.
