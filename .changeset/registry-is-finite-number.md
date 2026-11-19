---
'@weasel-js/registry': minor
---

`isFiniteNumber(value)` says whether a value is a finite number, and narrows it to `number` where `Number.isFinite` does not.

```ts
import { isFiniteNumber } from '@weasel-js/registry';

const zoom = isFiniteNumber(stored.zoom) ? stored.zoom : 1;
```

<!-- entry: api -->
