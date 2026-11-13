---
'@weasel-js/text': major
'@weasel-js/text-shaping': major
---

The engine contracts share their names across packages: `@weasel-js/text`'s `BidiResolver` is now `BidiEngine`, as `@weasel-js/bidi` calls it, and `@weasel-js/text-shaping`'s `Shaper` is now `TextShaper`, as `@weasel-js/text` calls it.

```ts
// before
import type { BidiResolver } from '@weasel-js/text';
import type { Shaper } from '@weasel-js/text-shaping';
// after
import type { BidiEngine } from '@weasel-js/text';
import type { TextShaper } from '@weasel-js/text-shaping';
```

<!-- entry: breaking -->
