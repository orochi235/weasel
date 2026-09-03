---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Stop a stroke with no paint from blanking the whole document.

`SelectionPanel`'s object leaf started from `{}` when the node held no value
yet, so editing any non-paint field of `data.stroke` on an unstroked node
committed that field alone — a `Stroke` with no `paint`, which the type
forbids. The leaf's declared `default` was dead for writes; it now seeds from
it, so writing one field materializes a complete value.

Such a stroke threw out of `fillInPoseFrame`, and the throw escaped the painter
and took the frame with it: the document page and every other node vanished,
and the canvas stayed stale until something unrelated requested a redraw — so
WeaselDraw opened on an empty workspace and only drew once the pointer moved.
`resolveNodeStroke` now reads a paintless stroke as no stroke, and the text
painter routes through it like every other painter. The frame loop no longer
loses its dirty flag when a paint throws, so one bad frame is retried rather
than stranding the surface.
