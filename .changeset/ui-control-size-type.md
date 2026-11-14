---
'@weasel-js/ui': major
'@weasel-js/ui-logic': major
'@weasel-js/labkit': major
---

`ControlSize` replaces `ButtonSize`, `SegmentedSize`, `ToggleBarSize`, `ButtonBarSize`, and `OptionsBarSize`.

Each was `'sm' | 'md'`, so only the name changes. `ControlSize` is exported from `@weasel-js/ui`, `@weasel-js/ui/components/Density`, `@weasel-js/ui-logic`, and `@weasel-js/labkit`.

```ts
// before
import type { ToggleBarSize } from '@weasel-js/ui';
// after
import type { ControlSize } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
