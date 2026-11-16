---
'@weasel-js/ui': major
'@weasel-js/routing': minor
---

`swallowNextClick` moves from `@weasel-js/ui` to `@weasel-js/routing`, beside `swallowClick`, which swallows the next click until disarmed.

```ts
// before
import { swallowNextClick } from '@weasel-js/ui';
// after
import { swallowNextClick } from '@weasel-js/routing';
```

It now cancels the click's default action as well; pass `{ keepDefault: true }` to only stop it reaching listeners, as before.

<!-- entry: breaking api -->
