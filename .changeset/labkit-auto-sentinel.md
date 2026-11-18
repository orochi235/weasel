---
'@weasel-js/labkit': major
---

labkit's config sentinel is prefs' `AUTO`, re-exported under that name; labkit's own `auto` alias for it is gone. `type Auto` is now prefs' type, re-exported.

```ts
// before
import { auto } from '@weasel-js/labkit';
f.number(3).initial(auto);
// after
import { AUTO } from '@weasel-js/labkit';
f.number(3).initial(AUTO);
```

<!-- entry: breaking api -->
