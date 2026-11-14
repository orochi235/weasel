---
'@weasel-js/core': major
---

core's `normalizeZoom` is now geom's own function, and `@weasel-js/core/engine` no longer exports it; import it from `@weasel-js/geom`.

`@weasel-js/core` still re-exports it. Calling it clamps silently, as geom's always did; the dev warning for a zoom that was never valid (0, NaN, or infinite) now comes only from `normalizeView`, for a view the kit is handed.

```ts
// before
import { normalizeZoom } from '@weasel-js/core/engine';
// after
import { normalizeZoom } from '@weasel-js/geom';
```

<!-- entry: breaking behavior -->
