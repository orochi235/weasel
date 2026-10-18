---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Spiro curves have a `g4` point kind: tangent, curvature, and the curvature's first two derivatives all carry through it, so a run of `g4` points bends more evenly than `smooth` ones. A segment with a `g4` point at either end is a cubic-curvature segment rather than an Euler spiral: `fitEulerSegment` takes the two higher terms (`k2`, `k3`) as optional arguments, `EulerFit` carries them (zero on an Euler spiral), and `eulerCurvatureDerivativesAt` answers the curvature's first two derivatives. Where such a segment meets a point that is not `g4`, its curvature's second derivative is zero there. `setSpiroKind` gains the kind as a variant, and path edit marks a `g4` point with a diamond.
