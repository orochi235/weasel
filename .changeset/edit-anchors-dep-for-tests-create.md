---
'@weasel-js/core': major
---

`makeEditAnchorsDepForTests` on `@weasel-js/core/test-seams` is now `createEditAnchorsDepForTests`, beside `createSnapSession2dForTests`.

```ts
// before
import { makeEditAnchorsDepForTests } from '@weasel-js/core/test-seams';
// after
import { createEditAnchorsDepForTests } from '@weasel-js/core/test-seams';
```

<!-- entry: breaking api -->
