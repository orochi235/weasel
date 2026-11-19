---
'@weasel-js/path-tools': major
---

Path-tools' all-families preset `pathTools` moves to `@weasel-js/path-tools/presets`, beside every other path-tools preset.

Its preset id is still `'pathTools'`.

```tsx
// before
import { pathTools } from '@weasel-js/path-tools';
<SceneCanvas features={[presets.draw, pathTools]} tools={tools} />
// after
import * as pathTools from '@weasel-js/path-tools/presets';
<SceneCanvas features={[presets.draw, pathTools.pathTools]} tools={tools} />
```

<!-- entry: breaking api -->
