---
'@weasel-js/core': major
'@weasel-js/paint': minor
---

The hex-alpha helpers and the kit's default paints move from `@weasel-js/core` to `@weasel-js/paint`: `solid`, `solidStroke`, `toHex8` and the rest.

This is breaking: import `toHex8`, `hexAlpha`, `withAlpha01`, `mergeAlphaFromPrev`, `solid`, `solidStroke`, `strokeWith`, `paintAlpha`, `paintWithAlpha`, `paintWithColor`, `paletteColorAt`, `DEFAULT_FILL_COLOR`, `DEFAULT_STROKE_COLOR`, `DEFAULT_PALETTE` and `GHOST_STROKE_COLOR` from `@weasel-js/paint`.

```ts
import { solid, solidStroke } from '@weasel-js/paint';
```

<!-- entry: rank=10 breaking api -->
