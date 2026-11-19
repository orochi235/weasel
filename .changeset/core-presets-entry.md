---
'@weasel-js/core': major
---

Core's view presets move to `@weasel-js/core/presets` as `view` and `viewTools`; the main entry no longer exports `viewPreset` or `viewToolsPreset`.

`@weasel-js/editing/presets` carries the same two objects beside editing's presets, so a canvas importing those needs nothing from core's entry.

```tsx
// before
import { SceneCanvas, viewPreset } from '@weasel-js/core';
<SceneCanvas features={[viewPreset]} />;

// after
import { SceneCanvas } from '@weasel-js/core';
import * as corePresets from '@weasel-js/core/presets';
<SceneCanvas features={[corePresets.view]} />;
```

<!-- entry: rank=10 breaking api -->
