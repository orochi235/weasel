---
'@weasel-js/geom': patch
---

`pathUnion`, `pathIntersect`, `pathSubtract` and `pathExclude` keep curves. Where any input has a quadratic or cubic, the outlines are cut where they cross, each piece is kept or dropped by the winding on its two sides, and the result's curves are pieces of the inputs' curves: two circles united where they do not touch come back as their own cubics. This changes their output, which used to be straight segments only. Inputs of straight lines only, inputs over 4096 segments, and the cases the curve path declines (outlines that coincide or share a stretch, a cubic that crosses itself) still go through `polygon-clipping` and come back flattened. `pathDivide`, `pathCrop`, `pathTrim`, `pathMerge` and the face pieces still flatten.
