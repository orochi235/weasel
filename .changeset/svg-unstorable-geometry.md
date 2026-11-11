---
"@weasel-js/svg": patch
---

`parseSvg` drops a shape whose coordinates reach past what a path can store, with a warning, rather than keeping `Infinity` and `NaN` coordinates.

The limit is float32's range from the path's origin: a `<line x2="6.8e38">`, or a `<rect>` under `transform="scale(1e308)"`.

<!-- entry: fix -->
