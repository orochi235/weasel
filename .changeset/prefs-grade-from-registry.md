---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`PrefGrade` is removed: an action leaf's `grade` is `Grade` from @weasel-js/registry, the same type theme and ui use.

```ts
import type { Grade } from '@weasel-js/registry'; // was: import type { PrefGrade } from '@weasel-js/prefs'
```

<!-- entry: breaking -->
