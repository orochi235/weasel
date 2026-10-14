---
'@weasel-js/core': patch
---

Every adapter carries the tree. `getParent` and `getChildren` are required on `MoveAdapter` (and so on `SelectAdapter`), `getNode`, `getParent`, and `getChildren` on `InsertAdapter`, both methods on `OrderedAdapter`, and `getParent` on `AlignAdapter`, `DistributeAdapter`, and `PickTopMostHitAdapter`. `BooleansAdapter` and `CreateOutlinesAdapter` require `getNode`, `getParent`, and `getChildren`, and `BooleansAdapter` requires `setChildOrder` too. The readers no longer carry a second path for an adapter that leaves one out: the default pick of `useSelectTool` walks `getChildren` and never `getNodes()`, and the insert, delete, reparent, and reorder ops call the tree reads without checking for them.

Breaking: an adapter written by hand without these methods no longer compiles, and an op applied against an object without them throws where it used to skip the step. A store with no nesting answers as a tree of roots: `getParent: () => null` and `getChildren: (parentId) => (parentId === null ? ids : [])`. A node with no children must answer `[]`; an adapter that answers the whole list for every parent makes a delete op recurse until the stack overflows.

Also breaking: `BooleansAdapter.getZOrder` is removed, since the slot it overrode is now always read through `getParent` and `getChildren`, and `pickTopMostHit` takes an adapter, no longer `null` or `undefined`.

`sceneAdapter.ts` no longer imports React (`useSceneAdapter` lives in its own module, exported as before), and a detached scene view (`renderSceneToCanvas`, `renderSceneToPixels`) reads the scene through `sceneToAdapter`.
