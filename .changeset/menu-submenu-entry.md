---
'@weasel-js/menu': major
---

The submenu variant of `MenuEntry` is typed `MenuSubmenuEntry`, where it was `SubmenuEntry`, like `MenuSeparatorEntry` beside it.

```ts
// before
import type { SubmenuEntry } from '@weasel-js/menu';
// after
import type { MenuSubmenuEntry } from '@weasel-js/menu';
```

<!-- entry: breaking api -->
