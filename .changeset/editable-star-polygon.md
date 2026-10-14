---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A drawn polygon or star stays editable as one. The `insert` dep stores the parameters it was drawn with on the node as `data.generator` (`{ kind: 'polygon', sides, rotation }` or `{ kind: 'star', points, innerRadiusRatio, rotation }`) beside `data.path`, which stays the geometry every reader uses. The `polygon`, `star`, and inferred `path` entries of `defaultNodeProperties` / `inferredNodeProperties` show Sides, or Points and Inner, for a node holding one, and changing one makes the shape again on the same circle, under the same rotation, in the same undo step.

Editing the path in path edit drops the generator, leaving plain geometry; so does changing a parameter of a shape whose path no longer matches its generator.

`NodePropertiesEntry` gains `settle(next, prev)`: what a property write stores, given the node as the write left it and as it was. `SelectionPanel` applies it to commits and to slider drafts. Core exports the generator helpers: `regenerateShape`, `settleShapeGenerator`, `shapeGeneratorOf`, `shapeGeneratorPath`, `clampShapeGenerator`, `isShapeGenerator`, `withoutShapeGenerator`, `SHAPE_COUNT_RANGE`, `STAR_RATIO_RANGE`, and the `ShapeGenerator` types.

A committed polygon or star is no longer stretched: its pose was the box of its circle, and the stored path's own box was stretched to fill it, so a five-point star came out stretched 5% along one axis and 10% along the other, unlike its preview. The pose, and the insert's reported bounds, are now the box of the shape itself.
