---
'@weasel-js/paint': major
'@weasel-js/ui': major
---

`solidColorOf`, `strokeColorOf` and `PaintSlot` moved from `@weasel-js/ui` to `@weasel-js/paint`, and ui's `./paint-value` subpath is gone.

```ts
// before
import { solidColorOf, type PaintSlot } from '@weasel-js/ui/paint-value';
// after
import { solidColorOf, type PaintSlot } from '@weasel-js/paint';
```

<!-- entry: breaking api -->
