---
'@weasel-js/text': major
'@weasel-js/text-shaping': major
---

`BidiResolver` is renamed `BidiEngine`, and text-shaping's `Shaper` is renamed `TextShaper`.

Each engine contract now has one name across packages: `@weasel-js/bidi` already called the first `BidiEngine`, and `@weasel-js/text` already called the second `TextShaper`.

```ts
// before
import type { BidiResolver } from '@weasel-js/text';
import type { Shaper } from '@weasel-js/text-shaping';
// after
import type { BidiEngine } from '@weasel-js/text';
import type { TextShaper } from '@weasel-js/text-shaping';
```

<!-- entry: breaking -->
