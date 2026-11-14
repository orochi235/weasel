---
'@weasel-js/paint': major
'@weasel-js/ui': major
---

`paintPreviewCss` is imported from `@weasel-js/paint`, beside a new `sampledCssStops`; `@weasel-js/ui` no longer exports it.

`sampledCssStops(colorAt, samples, positionOf)` writes `samples + 1` evenly spaced CSS color stops, for a gradient CSS cannot blend in the right space by itself.

```ts
// before
import { paintPreviewCss } from '@weasel-js/ui';
// after
import { paintPreviewCss } from '@weasel-js/paint';
```

<!-- entry: breaking api -->
