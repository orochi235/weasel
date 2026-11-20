---
'@weasel-js/diagram': minor
---

`outlineRings(outline, bounds)` answers an outline as one closed ring per subpath, and `rayHit` accepts those rings.

`outlinePolyline` now closes each subpath on its own; cast a ray at `outlineRings` where the outline may have more than one.

<!-- entry: api -->
