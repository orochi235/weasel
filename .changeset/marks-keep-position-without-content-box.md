---
'@weasel-js/labkit': patch
---

Marks on a target with no content box keep their place: reads use the last known box, and placing or moving one throws.

A target the instrument stops declaring keeps reporting its marks where they are. `add`, and an `update` with `frac` or `points`, throw on a target whose content box was never known, rather than storing the mark at the origin.

<!-- entry: fix behavior -->
