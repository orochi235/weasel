---
'@weasel-js/ui': patch
---

`Popover` and `Tooltip` inside a box drawn at another size (`transform: scale()` or `zoom`) now flip, shift and limit their height against the viewport as they would at 1×, and a top-placed one sits against its trigger instead of `(f − 1)` box heights above it. Inside such a box they portal into an overlay frame laid over the viewport, which React Aria places them in and against; nothing changes for an unscaled box. A caller's `boundaryElement` is still used as given.
