---
'@weasel-js/ui-input': major
'@weasel-js/ui-logic': major
---

`pressStep`, `isPressKey`, and `IDLE_PRESS` move from `@weasel-js/ui-logic` to `@weasel-js/ui-input`.

The `PressState` and `PressInput` types move with them.

Their behavior is unchanged; ui-logic no longer exports them.

```ts
// before
import { IDLE_PRESS, pressStep } from '@weasel-js/ui-logic';
// after
import { IDLE_PRESS, pressStep } from '@weasel-js/ui-input';
```

<!-- entry: breaking api -->
