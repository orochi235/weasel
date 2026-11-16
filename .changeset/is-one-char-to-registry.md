---
'@weasel-js/ui-input': major
'@weasel-js/registry': minor
---

`isOneChar` moved from `@weasel-js/ui-input` to `@weasel-js/registry`, beside `codePointFloor`; it is unchanged.

```ts
// before
import { isOneChar } from '@weasel-js/ui-input';
// after
import { isOneChar } from '@weasel-js/registry';
```

<!-- entry: breaking api -->
