---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`tone` now means one thing everywhere: which of its peers a surface is. Breaking: `Badge`'s and `PowerlineSegment`'s status prop is renamed from `tone` to `status`, and `BadgeTone` to `BadgeStatus` (labkit's passthrough re-export follows). The rendered attribute is `data-status` rather than `data-tone`. There is no alias; a status string passed as `tone` is now read as a color.

`Badge`, `Code`, `Button` and `PowerlineSegment` also take `stance` and a peer `tone` — an index into the theme's tone list, or a color — as panels do. The tone, or a stance's `accent`, paints over the status color, and a toned primary button takes the tone as its accent.
