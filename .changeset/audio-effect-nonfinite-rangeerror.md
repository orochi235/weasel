---
'@weasel-js/audio': patch
---

An effect built with a non-finite option, such as `createFilterEffect(ctx, { frequency: NaN })`, throws the package's `RangeError` rather than the browser's `TypeError`.

<!-- entry: fix -->
