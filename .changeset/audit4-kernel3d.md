---
'@weasel-js/kernel3d': patch
---

An orbit, pan or pinch dolly no longer undoes a camera change made while it runs, such as a wheel dolly during an orbit drag; the gesture carries on from the camera the other writer set.
`projectAabbToScreen` clips at the far plane as well as the near one, so a marquee no longer selects, and selection chrome no longer outlines, a solid the camera does not draw.
`createInsert` declines a rectangle with no drag ends whose corners reach past the horizon, rather than minting a footprint from the corners that reached the ground.
