---
'@weasel-js/kernel3d': patch
---

`createNodeAtPoint` picks only what the camera draws. A node clipped away in front of the near plane, or past the far plane, used to be picked anyway, and one close to the eye blocked every pick behind it while nothing was drawn there.

`rayThroughScreenPoint` now runs from the near plane to the far plane: its `origin` is the near-plane point and its `direction` reaches the far one, so `t` from 0 to 1 spans what the camera draws. It no longer takes an `eye` argument, and its direction is no longer unit length. This is a breaking change for a caller that passed the eye or read the direction as a unit vector; normalize it where that matters.
