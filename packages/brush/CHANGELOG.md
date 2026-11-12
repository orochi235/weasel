# @weasel-js/brush

## 1.19.0

### Patch Changes

- f8f604b: New package `@weasel-js/brush` lets several brush tools share one brush size. `shareBrushSize(options)` keeps a brush's size option under the `BRUSH_SIZE_PX` key; hand it to each brush tool's `share` option and they share one size, held to each tool's own bounds. A brush not given it keeps its own size.
  
  `linkBrushSize`, `SHARED_BRUSH_SLOT` and `SHARED_BRUSH_SIZE` are gone: pass `shareBrushSize(options)` as each tool's `share` instead.
  
  <!-- entry: rank=10 breaking new api -->
- Updated dependencies [6646205]
- Updated dependencies [976bdf2]
- Updated dependencies [d4c2b70]
- Updated dependencies [82e3877]
- Updated dependencies [020f69a]
- Updated dependencies [562c8a2]
- Updated dependencies [a1911f5]
- Updated dependencies [c0b44f0]
- Updated dependencies [7736185]
- Updated dependencies [f63f932]
- Updated dependencies [a933054]
- Updated dependencies [ae820c2]
- Updated dependencies [8710c48]
- Updated dependencies [7d5ab0e]
- Updated dependencies [ef5634e]
- Updated dependencies [7c02aa8]
- Updated dependencies [08c143e]
- Updated dependencies [11ffe9f]
- Updated dependencies [81e2cf4]
- Updated dependencies [744af77]
- Updated dependencies [47a4976]
- Updated dependencies [6bd1b2b]
- Updated dependencies [45c01e4]
- Updated dependencies [a7578e7]
- Updated dependencies [0a82772]
- Updated dependencies [3643214]
- Updated dependencies [b80eae4]
  - @weasel-js/routing@1.19.0
