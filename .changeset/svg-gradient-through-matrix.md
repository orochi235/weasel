---
'@weasel-js/svg': patch
---

A user-space gradient carried through a transform it could not hold stayed wrong without a word. A linear gradient under a skew or a non-uniform scale mapped its end point through the transform, which tilts its bands; it now ends where the transformed bands put it. A conic gradient under a rotation kept its start angle; it now turns with the rotation. A radial gradient under a skew or a non-uniform scale, and a conic one under those or a mirror, are still painted as the model can, and `parseSvg` now warns that they are.
