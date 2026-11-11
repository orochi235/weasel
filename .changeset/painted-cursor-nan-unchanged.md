---
"@weasel-js/cursor": patch
---

The painted-cursor store reads a `NaN` angle, size, radius, or pointer coordinate written again as no change, and does not notify, where each such write notified and asked for a repaint.
