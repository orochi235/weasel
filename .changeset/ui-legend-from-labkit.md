---
'@weasel-js/ui': minor
'@weasel-js/labkit': major
---

`Legend`, the color key, moves from labkit to `@weasel-js/ui/components/Legend`; labkit no longer exports it.

```tsx
// before
import { Legend } from '@weasel-js/labkit';
// after
import { Legend } from '@weasel-js/ui/components/Legend';
```

Its swatch color rides `--legend-ink` in place of `--lk-legend-ink`, and its `lk-legend*` classes are gone.

<!-- entry: breaking api -->
