---
"@weasel-js/svg": patch
---

`parseSvg` drops a shape whose coordinates reach past what a path can store (float32's range from the path's origin), with a warning, where it used to keep the shape with `Infinity` and `NaN` coordinates: a `<line x2="6.8e38">`, or a `<rect>` under `transform="scale(1e308)"`.
