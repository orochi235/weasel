---
'@weasel-js/labkit': major
---

labkit's `worldToScreen`, `screenToWorld` and `zoomAt` are `labWorldToScreen`, `labScreenToWorld` and `labZoomAt`, apart from core's.

This is a breaking rename, with no alias; `ZoomAtOptions` is `LabZoomAtOptions`. They take the same arguments as before and now compute through core's `View` maps and `zoomAt`, so a non-finite pan reads as 0, as every other labkit camera path already treats it.

```ts
// before
import { screenToWorld, zoomAt } from '@weasel-js/labkit';
// after
import { labScreenToWorld, labZoomAt } from '@weasel-js/labkit';
```

<!-- entry: breaking api -->
