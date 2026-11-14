---
'@weasel-js/ui': major
---

`useFloatingPlacement` moves from the `@weasel-js/ui/floating` subpath to `@weasel-js/ui/components/FloatingPanel`, beside the panel built on it.

The `./floating` subpath is gone. The hook, its option and result types, and the root barrel export are unchanged.

```ts
// before
import { useFloatingPlacement } from '@weasel-js/ui/floating';
// after
import { useFloatingPlacement } from '@weasel-js/ui/components/FloatingPanel';
```

<!-- entry: breaking api -->
