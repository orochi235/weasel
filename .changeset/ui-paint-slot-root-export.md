---
'@weasel-js/ui': major
---

`PaintSlot` is exported from `@weasel-js/ui` beside `solidColorOf`, and no longer from `@weasel-js/ui/components/GradientEditor`.

```ts
// before
import type { PaintSlot } from '@weasel-js/ui/components/GradientEditor';
// after
import type { PaintSlot } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
