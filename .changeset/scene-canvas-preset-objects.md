---
'@weasel-js/core': major
---

`<SceneCanvas features>` takes preset objects only, and a bundle carries just the presets it imports.

Breaking: a name in `features` throws. Pass the exported object for each name instead:

```tsx
// before
<SceneCanvas features={['pick', 'move', 'tools:shape']} />
// after
import * as presets from '@weasel-js/editing/presets';
<SceneCanvas features={[presets.pick, presets.move, presets.shapeTools]} />
```

Each name `n` is `presets.n`, and `tools:x` is `presets.xTools`. Code that picks presets by name (a URL, a settings file) imports `namedFeatures` from the new `@weasel-js/core/named-features` entry: `namedFeatures('pick', 'move')` returns `[presets.pick, presets.move]`, and loads every core preset. `SCENE_CANVAS_FEATURES` and the `Feature` type are now `FEATURE_NAMES` and `FeatureName` there; `FEATURE_PRESETS` and `FEATURE_ACTION_IDS` moved there too. `FeatureEntry` and `NamedPresets` are gone: `features` is `readonly FeaturePreset[]`.

<!-- entry: rank=20 breaking api -->
