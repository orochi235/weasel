---
'@weasel-js/paint': major
'@weasel-js/ui': major
---

The color ramp helpers moved from `@weasel-js/ui` to `@weasel-js/paint`, and `oklchToHex` gives way to paint's `oklchDegToHex`.

`rampColor`, `colorRamp`, `ColorRampOptions`, `chromaAt`, `ChromaCurve` and `ChromaCurvePoint` move. ui's `./color` subpath is gone.

```ts
// before
import { chromaAt, oklchToHex, type ChromaCurve } from '@weasel-js/ui/color';
// after
import { chromaAt, oklchDegToHex, type ChromaCurve } from '@weasel-js/paint';
```

<!-- entry: breaking api -->
