---
"@weasel-js/plot": patch
"@weasel-js/ui": patch
---

`@weasel-js/plot` now holds the one implementation of scales and ticks, and ui uses it.

`@weasel-js/plot/scales` is a new subpath with every scale and tick helper and no React, DOM or scene. A linear
scale gains `spacedTicks({ minSpacing, inset })`, which picks ticks by the room between them along the range and
returns them with their step and shared decimals; `niceStep`, `decimalsOf`, `tickDecimals`, `formatTick`,
`TickSet`, `TickFormatCtx`, `TickFormatter` and `ContinuousScaleFactory` are exported beside it.

This breaks ui's API. Removed from `@weasel-js/ui`, with what replaces each:

- `niceTicks`, `niceStep`, `stepDecimals`, `tickDecimals`, `formatTick` and their types: import from
  `@weasel-js/plot/scales`; `niceTicks(range, px, opts)` is `linearScale({ domain: range, range: [0, px] })
  .spacedTicks(opts)`, and `stepDecimals` is `decimalsOf`.
- `linearScale`, `logScale`, `SliderScale` (from `Slider`) and `BandScale` (from `BandEditor`): `Slider`'s and
  `BandEditor`'s `scale` prop now takes a scale factory such as plot's `logScale`, which the control calls with
  `{ domain: [min, max], range: [0, 1] }`. A hand-written `{ toUnit, fromUnit }` no longer fits; build a
  `ContinuousScale` instead. A `Slider` given `logScale` with a `min` of zero or below now throws rather than
  placing its thumbs at `NaN`.
