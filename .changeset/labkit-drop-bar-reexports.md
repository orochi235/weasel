---
'@weasel-js/labkit': major
---

`@weasel-js/labkit` and `@weasel-js/labkit/primitives` no longer re-export `Toolbar`, `StatusBar`, `StatusBarItem`, `StatusBarSpacer` or `ScaleBar`.

Import `ScaleBar` from `@weasel-js/ui/components/ScaleBar`. `Toolbar` and `StatusBar` are gone from `@weasel-js/ui` too: draw a `Bar`, `roving` for a toolbar and `framed="status"` for a status strip.

```tsx
// before
import { ScaleBar, StatusBar, Toolbar } from '@weasel-js/labkit';
// after
import { ScaleBar } from '@weasel-js/ui/components/ScaleBar';
import { Bar } from '@weasel-js/ui/components/Bar';
```

<!-- entry: breaking api -->
