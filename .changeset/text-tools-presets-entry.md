---
'@weasel-js/text-tools': major
---

Text-tools' presets move off the main entry to `@weasel-js/text-tools/presets`, as `text`, `textTools` and `whiteboard`.

`textPreset`, `textToolsPreset` and `whiteboardPreset` are gone from the main entry; `createTextPreset` and `createTextToolsPreset` stay on the main entry.

```tsx
// before
import { textPreset, textToolsPreset } from '@weasel-js/text-tools';
<SceneCanvas features={[drawPreset, textPreset, textToolsPreset]} />;

// after
import * as textTools from '@weasel-js/text-tools/presets';
<SceneCanvas features={[presets.draw, textTools.text, textTools.textTools]} />;
```

<!-- entry: rank=10 breaking api -->
