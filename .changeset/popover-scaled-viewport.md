---
'@weasel-js/ui': patch
---

`Popover` and `Tooltip` inside a box drawn at another size (`transform: scale()` or `zoom`) now flip, shift and limit their height against the viewport as they would at 1×, and a top-placed one sits against its trigger instead of `(f − 1)` box heights above it. Portaled into any positioned container, scaled or not, they are no longer shifted sideways as though the viewport's corner sat at the container's. In such a container they portal into an overlay frame laid over the viewport, which React Aria places them in and against; in an unscaled container the frame is `position: fixed`, so it adds nothing to the scroll range of a container that scrolls, and a popover there is no longer clipped by that container's `overflow`. A caller's `boundaryElement` is still used as given.
