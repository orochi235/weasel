---
'@weasel-js/menu': major
---

`@weasel-js/menu` no longer exports `MenuShortcut`; the shortcut shape is `ShortcutInput` from `@weasel-js/gestures`, which menu now depends on.

`ShortcutInput` was already an alias of `MenuShortcut`, so the shape is unchanged; a menu row's `shortcut` takes a `ShortcutInput` or a string.

```ts
// before
import type { MenuShortcut } from '@weasel-js/menu';
// after
import type { ShortcutInput } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
