---
'@weasel-js/core': minor
---

Core exports the types its pick-index, memo, and slot helpers name, so code calling them can write those types down.

`PickBroad`, `PickCandidate` and `ClipBearing` (what `indexedCandidates` takes and returns), `NodeMemoScope` and
`createNodeMemoScope` (a private `slot` for `nodeMemo`), and `ParentedReader` (what `locateChild` reads) come from
`@weasel-js/core`; `RegionQueryOptions`, `ScenePickSourceOptions` and `ViewPickGates` from
`@weasel-js/core/test-seams`, beside `hitTestAreaForTests`.

<!-- entry: rank=-5 api -->
