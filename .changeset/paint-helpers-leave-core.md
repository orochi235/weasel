---
'@weasel-js/core': major
'@weasel-js/paint': minor
---

The hex-alpha helpers and the kit's default paints move from `@weasel-js/core` to `@weasel-js/paint`: `solid`, `strokeOf`, `toHex8` and the rest.

This is breaking: import `toHex8`, `getAlpha01`, `withAlpha01`, `mergeAlphaFromPrev`, `solid`, `strokeOf`, `strokeWith`, `paintAlpha`, `paintWithAlpha`, `paintWithColor`, `paletteColorAt`, `DEFAULT_FILL_COLOR`, `DEFAULT_STROKE_COLOR`, `DEFAULT_PALETTE` and `GHOST_STROKE` from `@weasel-js/paint`.

```ts
import { solid, strokeOf } from '@weasel-js/paint';
```

<!-- entry: rank=10 breaking api -->
