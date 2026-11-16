---
'@weasel-js/core': major
'@weasel-js/editing': minor
'@weasel-js/editor': patch
---

The clipboard ops and wire format move from `@weasel-js/core` to `@weasel-js/editing`, retiring `@weasel-js/core/clipboard`.

This is breaking. These are editing's now, under the same names: `useClipboard`, `useClipboardOps`, `WEASEL_CLIPBOARD_MIME`, `WEASEL_CLIPBOARD_MIME_WEB`, `buildWeaselClipboardText`, `sniffWeaselClipboardText`, `parseWeaselClipboardText`, `embedWeaselMetadataInSvg`, `extractWeaselClipboardFromSvg`, and the types `ClipboardFlavors`, `PastedItems`, `UseClipboardOptions`, `UseClipboardOpsOptions` and `UseClipboardOpsReturn`. `materializePaste` is no longer exported. The clipboard contract types (`ClipboardSnapshot`, `PasteCtx`, `PasteOmission`, `ClipboardDep`) stay in core. `@weasel-js/editor` now depends on `@weasel-js/editing`, whose `useClipboard` its `useDocClipboard` runs on.

```ts
// before
import { useClipboardOps } from '@weasel-js/core';
import { buildWeaselClipboardText } from '@weasel-js/core/clipboard';
// after
import { buildWeaselClipboardText, useClipboardOps } from '@weasel-js/editing';
```

<!-- entry: rank=10 breaking api -->
