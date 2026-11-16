---
'@weasel-js/ui': major
'@weasel-js/measure': minor
---

`MeasureReadout` moved from `@weasel-js/ui` into `@weasel-js/measure`, and ui no longer depends on measure.

The component and its props are unchanged. Its styles now ship in `@weasel-js/measure/style.css`; it still draws with ui's buttons, so keep `@weasel-js/ui/style.css` loaded too.

```ts
// before
import { MeasureReadout } from '@weasel-js/ui/components/MeasureReadout';
// after
import { MeasureReadout } from '@weasel-js/measure';
import '@weasel-js/measure/style.css';
```

<!-- entry: rank=5 breaking api -->
