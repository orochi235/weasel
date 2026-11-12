---
'@weasel-js/storage': minor
---

`onLeave(fn)` runs a flush when the page goes away or turns hidden, the moment a record cache already flushes its writes.

```ts
import { onLeave } from '@weasel-js/storage';

const stop = onLeave(() => saveNow(), { capture: true });
```

`capture` runs it ahead of other flushes on the same event. It may run twice for one leave, so `fn` writes only what is still pending.

<!-- entry: api -->
