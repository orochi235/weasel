---
'@weasel-js/guides': major
'@weasel-js/parallax': major
---

guides' and parallax's option types end in `Options`, as every other package's do.

`GridLayerOpts`, `GuidesLayerOpts` and `CellHighlightLayerOpts` (guides) and `CreateParallaxLayerOpts` and `CreateTiledLayerOpts` (parallax) are renamed, with no alias.

```ts
// Before
import type { GridLayerOpts } from '@weasel-js/guides';
import type { CreateParallaxLayerOpts } from '@weasel-js/parallax';

// After
import type { GridLayerOptions } from '@weasel-js/guides';
import type { CreateParallaxLayerOptions } from '@weasel-js/parallax';
```

<!-- entry: breaking api -->
