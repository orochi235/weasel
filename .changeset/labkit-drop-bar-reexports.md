---
'@weasel-js/labkit': major
---

`@weasel-js/labkit` and `@weasel-js/labkit/primitives` no longer re-export `Toolbar`, `StatusBar`, `StatusBarItem`, `StatusBarSpacer` or `ScaleBar`.

Import them, and their props types, from `@weasel-js/ui`'s component subpaths.

```ts
// before
import { ScaleBar, StatusBar, Toolbar } from '@weasel-js/labkit';
// after
import { ScaleBar } from '@weasel-js/ui/components/ScaleBar';
import { StatusBar } from '@weasel-js/ui/components/StatusBar';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
```

<!-- entry: breaking api -->
