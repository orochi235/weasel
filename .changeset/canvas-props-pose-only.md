---
'@weasel-js/core': patch
---

Breaking, in types only: `CanvasProps` takes one type argument, the pose, where it took the node type and the pose. Its `adapter` is now typed as what the canvas reads of it, `getPose` and an optional `getWorldPose`; it was typed as the move, resize, and rotate adapters together, so an adapter with only pose lookups needed a cast. Write `CanvasProps<TPose>` where you wrote `CanvasProps<TNode, TPose>`. `SceneCanvasProps` is unchanged.
