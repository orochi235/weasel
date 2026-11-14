---
'@weasel-js/ui': minor
'@weasel-js/labkit': major
---

`FpsMeter`, the live frame-rate readout, moves from labkit to `@weasel-js/ui/components/FpsMeter`; labkit no longer exports it.

```tsx
// before
import { FpsMeter } from '@weasel-js/labkit';
// after
import { FpsMeter } from '@weasel-js/ui/components/FpsMeter';
```

It now takes a `className`, and its `lk-fps-meter*` classes are gone.

<!-- entry: breaking api -->
