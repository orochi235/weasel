---
'@weasel-js/ui': major
'@weasel-js/core': major
---

Three modifier-key types that repeated the kit's two are gone: `PressModifiers`, `LayerModifiers` and `KeyModifiers`.

ui's `PressModifiers` is gestures' `EventModifiers` (the DOM form), and ui's `LayerModifiers` and core's `KeyModifiers` are routing's `ModifierState` (the short form). The shapes are unchanged.

```ts
// before
import type { PressModifiers } from '@weasel-js/ui';
import type { KeyModifiers } from '@weasel-js/core';
// after
import type { EventModifiers } from '@weasel-js/gestures';
import type { ModifierState } from '@weasel-js/core';
```

<!-- entry: breaking api -->
