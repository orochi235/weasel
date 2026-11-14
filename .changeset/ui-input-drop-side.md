---
'@weasel-js/ui-input': major
'@weasel-js/ui-logic': major
---

`dropSide` is imported from `@weasel-js/ui-input`, beside `dropBand` and `nearestGap`, instead of `@weasel-js/ui-logic`.

Its behavior is unchanged; ui-logic no longer exports it.

```ts
// before
import { dropSide } from '@weasel-js/ui-logic';
// after
import { dropSide } from '@weasel-js/ui-input';
```

<!-- entry: breaking api -->
