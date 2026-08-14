---
'@weasel-js/core': patch
---

Break rect batches on group state rather than on tree shape, so `SceneCanvas`
gets the batching.

A group was a batch barrier because it *might* move a uniform. `buildSceneTree`
gives every node its own group with no transform, alpha, colorMatrix or clip, so
in the scene shape every run broke after one rect and the previous release's
batching reached nothing the app renders. A run now carries the state it was
staged under and breaks only when the live state differs by value — which a
no-op wrapper never does.

Scene-shaped frame cost, M2 Max via ANGLE at 800x600 (`npm run test:perf`, new
`scene` variant — one wrapper group per command):

| rects | before | after |
|---|---|---|
| 400 | 26.32 ms | 0.03 ms |
| 1,600 | 105.18 ms | 0.11 ms |
| 3,200 | 208.72 ms | 0.36 ms |

Clips stay hard flush points in both directions: the stencil is GL state that a
staged run cannot reconstruct, so the flush happens before `pushClip` and before
`popClip` rather than at group boundaries. Text, images, shaders, strokes and
non-solid fills flush as before.
