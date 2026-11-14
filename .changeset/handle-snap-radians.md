---
'@weasel-js/path-tools': major
---

Handle snapping takes its angles in radians, as `angleStep` and `reachRad`, the names core's measure tool and snap sessions use.

`HandleSnapOptions`' `stepDeg` and `reachDeg` (degrees) are now `angleStep` and `reachRad` (radians); the defaults are unchanged at 45° and 6°.

```ts
import { DEG_TO_RAD } from '@weasel-js/geom';
// before
createHandleSnapPreset({ stepDeg: 15, reachDeg: 4 });
// after
createHandleSnapPreset({ angleStep: 15 * DEG_TO_RAD, reachRad: 4 * DEG_TO_RAD });
```

<!-- entry: breaking api -->
