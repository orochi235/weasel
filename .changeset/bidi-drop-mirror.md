---
'@weasel-js/bidi': major
---

Bidi's top-level `mirror` is gone; it was a second name for `mirrorOf`.

`BidiEngine`'s `mirror` method is unchanged.

```ts
// before
import { mirror } from '@weasel-js/bidi';
const glyph = mirror(cp);
// after
import { mirrorOf } from '@weasel-js/bidi';
const glyph = mirrorOf(cp);
```

<!-- entry: breaking api -->
