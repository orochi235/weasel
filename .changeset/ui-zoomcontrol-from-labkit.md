---
'@weasel-js/ui': minor
'@weasel-js/labkit': major
---

`ZoomControl`, a log-scaled zoom slider with a percentage field, moves from labkit to `@weasel-js/ui/components/ZoomControl`.

```tsx
// before
import { ZoomControl } from '@weasel-js/labkit';
// after
import { ZoomControl } from '@weasel-js/ui/components/ZoomControl';
```

Its `lk-zoom*` classes are gone; pass `className` to style it.

<!-- entry: breaking api -->
