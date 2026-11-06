---
'@weasel-js/core': patch
---

`NodeInk` carries the resolved `stroke` drawn along a node's silhouette in place of `trim`, which is now `ink.stroke?.trim`. A custom painter that reported `trim` reports `stroke` instead; text reports none, since its stroke follows its glyphs. Breaking for a painter or reader of `NodeInk.trim`.

A shape-following selection outline traces an open path by its own stroke's region, caps and heads included and dashes ignored, so a wire with an arrowhead is outlined around the line and the head rather than in a band as wide as the head.
