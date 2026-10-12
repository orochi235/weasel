---
'@weasel-js/animator': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/diagram': patch
'@weasel-js/d3': patch
'@weasel-js/minimap': patch
'@weasel-js/labkit': patch
---

add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.

core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.

`@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
