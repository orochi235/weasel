---
'@weasel-js/ui': major
---

`CurveEditor`'s `renderAnchor` argument is typed `AnchorRenderCtx`, where it was `AnchorRenderProps`.

It is a render function's argument, not a component's props.

```ts
// before
import type { AnchorRenderProps } from '@weasel-js/ui/components/CurveEditor';
// after
import type { AnchorRenderCtx } from '@weasel-js/ui/components/CurveEditor';
```

<!-- entry: breaking api -->
