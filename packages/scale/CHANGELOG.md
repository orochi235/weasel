# @weasel-js/scale

## 2.0.0

### Major Changes

- a68cc74: `ContinuousScale.map` is gone; call `position`, which every scale answers and which `map` only repeated.
  
  `OrdinalScale.map` stays.
  
  ```ts
  // before
  const at = x.map(25);
  // after
  const at = x.position(25);
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- dfcae5d: The scales move from `@weasel-js/plot` and its `./scales` entry to `@weasel-js/scale`.
  
  This is breaking: `@weasel-js/plot/scales` is gone, and `@weasel-js/plot` no longer exports `linearScale`, `logScale`, `powScale`, `warpScale`, `timeScale`, `bandScale`, `ordinalScale`, `polarScale`, `formatTick`, `formatNumber` or their types. Import them from `@weasel-js/scale`. A polar scale's points are geom's `Point`, the same `{ x, y }` as plot's `PlotPoint`.
  
  ```ts
  import { linearScale, formatTick } from '@weasel-js/scale';
  ```
  
  <!-- entry: breaking api -->
- a8e0b9a: New package `@weasel-js/scale`: linear, log, power, warped, time, band, ordinal and polar scales, their ticks, and the tick formatter.
  
  It needs only `@weasel-js/geom`, so a slider, a ruler or a server laying out an axis takes it without plot's scene graph.
  
  <!-- entry: new api -->
- 29c0156: A `warpScale` or `powScale` ticks on round values spaced evenly along its range, no longer evenly in value and bunched at one end.
  
  A tick's label keeps the decimals its value has, so `2.5` no longer reads as `3`.
  
  <!-- entry: behavior -->

### Patch Changes

- aef6bf7: A tick label at 1e21 or more writes the round value its tick sits on, `100000000000000000000000` for 1e23.
  
  <!-- entry: fix -->
- 1e1e868: A log scale in a base other than 10 ticks on that base's exact powers, so a base-2 axis labels 2^40 `1099511627776`.
  
  <!-- entry: fix -->
- 2f32eef: A log scale whose ends are too near for their logarithms to differ inverts a point to the value `position` put there.
  
  <!-- entry: fix -->
- 7ab6c70: A log scale zoomed in between two round values, such as 300 to 450, ticks as a linear scale would, rather than not at all.
  
  <!-- entry: fix -->
- cce50d5: A scale asked for `NaN` or `Infinity` ticks gives its default ticks, rather than a tick per unit or per second that could run to millions.
  
  <!-- entry: fix -->
- d510bd3: A polar scale given an `axes` count of `NaN` or `Infinity` has one axis, as a count below 1 does, rather than placing every point at `NaN`.
  
  <!-- entry: fix -->
- 1608601: A time scale whose domain starts in the earliest month a `Date` holds ticks on the months after it, rather than giving no ticks.
  
  <!-- entry: fix -->
- f4a888f: A time scale over a domain wider than a `Date` holds ticks on whole years, rather than one tick a second.
  
  <!-- entry: fix -->
- 684a6cd: A pow or warp scale's `format` labels its ticks as `tickFormat` does, so a square-root axis over 0 to 4 reads `0.15` rather than `0`.
  
  <!-- entry: fix -->
- 638d22c: A pow or warp scale over a domain narrower than its values' decade, such as 1.1 to 1.3, ticks on a finer decade.
  
  <!-- entry: fix -->
- 20bb330: A warped or power scale ticks on whole numbers only when its domain holds at least one whole number per tick.
  
  A log1p scale from 0 to 12 now ticks at 0, 1, 3, 6 and 10, where it ticked at 2.5. A domain too narrow for that, such as 0 to 2, still takes halves.
  
  <!-- entry: behavior -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [2c2ab71]
- Updated dependencies [4fb8cbf]
- Updated dependencies [9249b26]
- Updated dependencies [ec44e4c]
- Updated dependencies [4f264d0]
- Updated dependencies [29d293c]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [0046729]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [36dac61]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [de8f61d]
- Updated dependencies [ec23b4e]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [adb1290]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [6a9a3dc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [6fcc7aa]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [0d977b8]
- Updated dependencies [12816b7]
- Updated dependencies [aec0cec]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
