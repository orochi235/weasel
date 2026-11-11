---
"@weasel-js/kernel3d": patch
---

`rayThroughScreenPoint`, and `rayAt` and every pick, insert, ground hit, and snap built on it, cast a ray from a camera however far it sits from the world origin. The view-projection was inverted whole, and a camera more than about 300,000 units out carried a translation that made the matrix look too ill-conditioned to invert, so it named no ray at all; it is now inverted about the camera's eye.
