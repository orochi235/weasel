---
'@weasel-js/editing': major
---

Editing's presets are on `@weasel-js/editing/presets` only; the main entry no longer exports `drawPreset`, `pickPreset` or any other `…Preset`.

Import the entry as a namespace and use each preset's short name: `drawPreset` is `presets.draw`, `selectToolsPreset` is `presets.selectTools`, and so on for all of them. `FEATURE_PRESETS`, `namedFeatures` and the rest stay on the main entry.

```tsx
// before
import { drawPreset, useSelection } from '@weasel-js/editing';
<SceneCanvas features={[drawPreset]} />;

// after
import { useSelection } from '@weasel-js/editing';
import * as presets from '@weasel-js/editing/presets';
<SceneCanvas features={[presets.draw]} />;
```

<!-- entry: rank=20 breaking api -->
