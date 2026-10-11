---
'@weasel-js/core': patch
---

`<MinimapCanvas>` no longer breaks on a non-finite fit. One leaf whose pose had a `NaN` or infinite coordinate made `computeFitView`'s `"scene"` fit non-finite, so the minimap drew nothing; that leaf is now left out of the union. A custom `fit` function returning a zero or non-finite scale could send a non-finite point to `onMainViewChange` on a click; the fit view is now normalized like every other view.
