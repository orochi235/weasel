---
'@weasel-js/react': major
---

`__resetAdoptedCss` moves off the `@weasel-js/react` barrel to `@weasel-js/react/test-seams`, beside the other packages' test-only resets.

```ts
// before
import { __resetAdoptedCss } from '@weasel-js/react';
// after
import { __resetAdoptedCss } from '@weasel-js/react/test-seams';
```

<!-- entry: breaking api -->
