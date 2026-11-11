---
"@weasel-js/loupe": patch
---

`placeBand` gives a factor of at least `ZOOM_FLOOR` on a host with no room for the band, instead of 0, which mapped a pick in the lens to a non-finite point. The loupe model's `setFactor` no longer asks the surface to redraw when the clamped factor is the one it already has.
