---
'@weasel-js/ui': major
---

The `@weasel-js/ui/components/ContextMenu` subpath is now `@weasel-js/ui/components/Menu`.

The folder holds the whole menu layer that `MenuButton`, `MenuBar`, and the bar menus build on, with `ContextMenuHost` and `useContextMenu` inside it. Their names are unchanged, and the root barrel exports them as before.

```ts
// before
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui/components/ContextMenu';
// after
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui/components/Menu';
```

<!-- entry: breaking api -->
