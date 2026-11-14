---
'@weasel-js/bidi': major
---

`BIDI_UNICODE_VERSION` is gone; the Unicode version the tables were built from is `UNICODE_VERSION`, the name it already had beside it.

```ts
// before
import { BIDI_UNICODE_VERSION } from '@weasel-js/bidi';
// after
import { UNICODE_VERSION } from '@weasel-js/bidi';
```

<!-- entry: breaking api -->
