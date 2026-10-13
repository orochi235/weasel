---
'@weasel-js/core': patch
---

`animateOnSetPose` and `animateLifecycle` take any adapter with the methods they use, and return the adapter they were given with those methods replaced. The adapter `sceneToAdapter` and `useSceneAdapter` build now passes without a cast, and keeps its own type on the way out. Adds API: `LifecycleAdapter`, the part of an adapter `animateLifecycle` reads.

Breaking for a call that passes type arguments: `animateOnSetPose<TNode, TPose>` is now `animateOnSetPose<TPose, A>`, and `animateLifecycle<TNode, TPose>` gains the adapter's type as a third. A call that leaves them to inference is unaffected, except that a cast to `never` on the adapter now makes the result `never`: drop the cast.
