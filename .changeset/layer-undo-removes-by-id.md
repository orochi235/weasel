---
'@weasel-js/core': patch
---

Undoing an `addLayer`, or redoing a `removeLayer`, takes out that layer even after an untracked `moveLayer` put another at its old place.

<!-- entry: fix -->
