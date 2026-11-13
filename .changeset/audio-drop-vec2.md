---
'@weasel-js/audio': major
---

audio's deprecated `Vec2` type is removed; use `SpatialPoint`, which takes the same `x` and `y` and an optional `z`.

```ts
// before
import type { Vec2 } from '@weasel-js/audio';
// after
import type { SpatialPoint } from '@weasel-js/audio';
```

<!-- entry: breaking -->
