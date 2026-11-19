---
'@weasel-js/path-tools': major
---

Path-tools' presets move off the main entry to `@weasel-js/path-tools/presets`, each under its short name.

The main entry no longer exports any `…Preset`: `pathToolsPreset` is `pathTools.pathTools`, `pathsPreset` is `pathTools.paths`, `spiroPreset` is `pathTools.spiro`, and so on for each. The factories, `createFilletPreset`, `createDrapePreset` and the rest, stay on the main entry.

```tsx
// before
import { pathToolsPreset, usePathToolsTools } from '@weasel-js/path-tools';
<SceneCanvas features={[drawPreset, pathToolsPreset]} tools={usePathToolsTools()} />;

// after
import { usePathToolsTools } from '@weasel-js/path-tools';
import * as pathTools from '@weasel-js/path-tools/presets';
<SceneCanvas features={[presets.draw, pathTools.pathTools]} tools={usePathToolsTools()} />;
```

<!-- entry: rank=10 breaking api -->
