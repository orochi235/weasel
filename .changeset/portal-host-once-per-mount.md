---
'@weasel-js/ui': patch
---

Overlays resolve their portal host (the nearest themed ancestor) once per mount instead of on every render, so a page of closed tooltips no longer walks the DOM each time it re-renders. An ancestor themed imperatively after the overlay mounted is no longer picked up until the overlay remounts.
