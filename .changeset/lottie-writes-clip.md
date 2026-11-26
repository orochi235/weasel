---
'@weasel-js/lottie': minor
---

New package `@weasel-js/lottie` writes a clip and the SVG shapes it moves as a Lottie animation.

`writeLottie(nodes, clip, { fps, viewBox })` gives a Lottie JSON object, 60 frames a second unless `fps` says otherwise, on a canvas of the drawing's bounds unless `viewBox` gives another. Each drawn path becomes a shape layer with its solid fill and stroke; a `<id>.opacity` track keys the layer's opacity, and `<id>.trim.start` / `<id>.trim.end` a trim of its stroke. Key easings become bezier tangents, a single end step a hold, and any other easing the keyframes that trace it. Gradients, dashes and markers are skipped with a warning through `onWarn`, as is a clip that does not loop, since Lottie players loop. `lottieShapesOf(path)` gives a path's subpaths as Lottie beziers on their own.

<!-- entry: rank=10 new api -->
