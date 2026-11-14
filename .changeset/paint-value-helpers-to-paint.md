---
'@weasel-js/paint': major
'@weasel-js/ui': major
---

`solidColorOf`, `strokeColorOf` and `PaintSlot` moved from `@weasel-js/ui` to `@weasel-js/paint`, and ui's `./paint-value` subpath is gone.

`@weasel-js/ui/components/GradientEditor` no longer exports `PaintSlot` either.

```ts
// before
import { solidColorOf, type PaintSlot } from '@weasel-js/ui/paint-value';
import type { PaintSlot } from '@weasel-js/ui/components/GradientEditor';
// after
import { solidColorOf, type PaintSlot } from '@weasel-js/paint';
```

<!-- entry: breaking api -->
