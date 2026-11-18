---
'@weasel-js/ui': major
---

ui's `toFraction` and `spanFraction` are now `spanFraction` and `spanShare`, the names `@weasel-js/ui-input` gives the same two functions.

The name `spanFraction` moves: it now places a value along the window, where it used to measure a length's share of it. A call written for the old `spanFraction` still compiles, so rename those calls to `spanShare` before renaming `toFraction`.

```ts
// before
import { toFraction, spanFraction } from '@weasel-js/ui';
// after
import { spanFraction, spanShare } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
