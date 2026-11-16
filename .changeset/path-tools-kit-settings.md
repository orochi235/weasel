---
'@weasel-js/core': major
'@weasel-js/path-tools': minor
---

The pen's, the knife's and anchor clicking's kit settings move to `pathToolsKitSettingsSchema` in `@weasel-js/path-tools`.

`targets.anchorClickPx`, `targets.penAnchorRadiusPx`, `targets.penHandleDotRadiusPx`, `targets.penCloseHintRadiusPx`, `targets.penCloseHitPx`, `targets.sliceVertexRadiusPx` and `targets.sliceCloseHitPx` keep their paths and defaults; `coreKitSettingsSchema` and `CoreKitTargetSettings` no longer list them, and path-tools' `PathToolsKitTargetSettings` does. A settings page merges the new schema beside core's:

```ts
import { coreKitSettingsSchema } from '@weasel-js/core';
import { pathToolsKitSettingsSchema } from '@weasel-js/path-tools';
const kit = mergePrefGroups('Kit settings', coreKitSettingsSchema, pathToolsKitSettingsSchema);
```

<!-- entry: breaking api -->
