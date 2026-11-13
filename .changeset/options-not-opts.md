---
'@weasel-js/core': major
'@weasel-js/guides': major
'@weasel-js/parallax': major
---

Nineteen options types are renamed from `*Opts` to `*Options`, the suffix the rest of the kit's options types use.

Core: `CreateChildrenLayerOptions`, `CreateDebugOverlayLayerOptions`, `CreatePathLayerOptions`, `CreateTextLayerOptions`, `CreateViewportLayerOptions`, `CreateViewResolverOptions`, `ComposeSelectionPoseOptions`, `SelectionOutlineLayerOptions`, `SelectionHandlesLayerOptions`, `SelectionOverlayLayerOptions`, `NestedHitOptions`, `ParallaxOptions`, `SceneNodeClientRectOptions`, `UseViewHelpersOptions`. Guides: `GridLayerOptions`, `GuidesLayerOptions`, `CellHighlightLayerOptions`. Parallax: `CreateParallaxLayerOptions`, `CreateTiledLayerOptions`. Only the type names change.

```ts
// before
import type { ParallaxOpts, CreatePathLayerOpts } from '@weasel-js/core';
// after
import type { ParallaxOptions, CreatePathLayerOptions } from '@weasel-js/core';
```

<!-- entry: breaking api -->
