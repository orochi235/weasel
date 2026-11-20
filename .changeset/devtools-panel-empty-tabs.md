---
'@weasel-js/devtools': patch
---

`DevtoolsPanel` throws a `RangeError` on a `tabs` list naming no tab, such as `tabs={[]}`, rather than drawing an empty tab bar.

<!-- entry: fix -->
