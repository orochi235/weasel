---
'@weasel-js/ui': minor
---

Badge's catalog gives the params each shape, base, and effect draws with when none are set.

From `@weasel-js/ui/components/Badge`, `badgeShapeDefaults(shape)`, `badgeBaseDefaults(base)` and
`badgeEffectDefaults(effect)` each return a fresh copy of those defaults, empty for one that takes no params:

```ts
import { badgeShapeDefaults } from '@weasel-js/ui/components/Badge';

badgeShapeDefaults('ribbon'); // { left: 'inward', right: 'outward', taperWidth: 8 }
```

<!-- entry: api -->
