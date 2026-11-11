---
"@weasel-js/geom": patch
---

The 3D `invert` gives an affine matrix an inverse whose bottom row is exactly `0, 0, 0, 1`. It could come out an ulp off 1, which made the inverse projective: `transformPoint` divided by that `w`, and inverting it again returned null for a matrix as well conditioned as a scale of 1000.
