---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`BindingOpts` is `BindingOptions` (routing, and core's re-export), with the `Options` suffix every other option type in the kit carries.

```ts
// before
import type { BindingOpts } from '@weasel-js/routing';
// after
import type { BindingOptions } from '@weasel-js/routing';
```

<!-- entry: breaking api -->
