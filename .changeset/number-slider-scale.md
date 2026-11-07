---
'@weasel-js/plot': patch
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A number pref's slider can space its track other than linearly. A number leaf takes `scale`: `'linear'`, `'log'`, `'sqrt'`, or a `{ to, from }` pair, and labkit's `NumberNode` takes `.scale(...)`, so a segment count where 1–100 matters most, `f.number(16).range(1, 1000).step(1).scale('log')`, gives 1–10, 10–100 and 100–1000 a third of the track each. Only the track changes: the typed value, `step`, `stops`, the arrow keys and the stored value stay in the value's own units. Under a `unit` the scale spaces the shown values. A `'log'` track over a range not above zero warns once in development and is drawn linear. `PropertyField`'s number field takes `scale` as a `ContinuousScaleFactory`, as `Slider` does, and draws its stops where the scale puts them; ui's `prefNumberScale` turns a leaf's `scale`, or a factory, into one, naming its caller in the log warning when given a label. `BandEditor` resolves its `scale` through it too, so its log default now also falls back to linear, rather than throwing, while an edge drag stretches the axis down to zero or below. `PrefSchemaEditor` offers linear, log and sqrt for a number leaf. Additive.

`@weasel-js/plot/scales` adds `powScale({ domain, range, exponent })`, which keeps a negative value's sign so a square-root scale (`exponent: 0.5`) takes zero and negatives, and `warpScale({ domain, range, to, from })`, a scale linear in `to(value)`. Both tick and label in value units, as `linearScale` does. `Scale.kind` and `ContinuousScale.kind` gain `'pow'` and `'warp'`.
