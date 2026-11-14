---
'@weasel-js/ui-input': major
'@weasel-js/ui-logic': major
---

`pressStep`, `isPressKey` and `IDLE_PRESS`, with the `PressState` and `PressInput` types, are imported from `@weasel-js/ui-input` instead of `@weasel-js/ui-logic`.

Their behavior is unchanged; ui-logic no longer exports them.

```ts
// before
import { IDLE_PRESS, pressStep } from '@weasel-js/ui-logic';
// after
import { IDLE_PRESS, pressStep } from '@weasel-js/ui-input';
```

<!-- entry: breaking api -->
