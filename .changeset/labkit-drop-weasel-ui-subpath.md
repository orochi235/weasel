---
'@weasel-js/labkit': major
---

The `@weasel-js/labkit/weasel-ui` subpath is gone; import those names from `@weasel-js/ui` instead.

Each name it carried is published by `@weasel-js/ui`, mostly under a component subpath. `formatNumber` and `MINUS_SIGN` come from `@weasel-js/quantity`.

```ts
// before
import { CurveEditor, formatShortcut, useRovingTabIndex } from '@weasel-js/labkit/weasel-ui';
// after
import { CurveEditor } from '@weasel-js/ui/components/CurveEditor';
import { formatShortcut } from '@weasel-js/ui/components/ToolPalette';
import { useRovingTabIndex } from '@weasel-js/ui/roving-tab-index';
```

<!-- entry: breaking api -->
