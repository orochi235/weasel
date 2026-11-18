---
'@weasel-js/menu': major
---

`MenuGrade` is removed: a row's `grade` is `Grade` from @weasel-js/registry, the same type theme and ui use.

```ts
import type { Grade } from '@weasel-js/registry'; // was: import type { MenuGrade } from '@weasel-js/menu'
```

<!-- entry: breaking -->
