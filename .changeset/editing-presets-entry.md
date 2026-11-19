---
'@weasel-js/editing': minor
---

`@weasel-js/editing/presets` names every kit preset by its short name

```tsx
import * as presets from '@weasel-js/editing/presets';
<SceneCanvas features={[presets.view, presets.pick, presets.move, presets.delete]} />
```

Each is the same object as its `…Preset` export (`presets.pick` is `pickPreset`), core's `view` and `viewTools` among them.

<!-- entry: api -->
