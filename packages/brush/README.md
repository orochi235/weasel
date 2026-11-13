# @weasel-js/brush

Brushes for weasel tools. A tool's brush size is the option its `ToolOptions.size` names, the one `[`, `]` and
Shift+wheel step. By default each tool keeps its own. This package is for an app that wants one size shared
across its brushes.

```ts
import { shareBrushSize } from '@weasel-js/brush';

const share = shareBrushSize(SMUDGE_BRUSH_TOOL_OPTIONS); // { radiusPx: 'brushSizePx' }
const smudge = useSmudgeBrushTool({ share });
const simplify = useSimplifyBrushTool({ share: shareBrushSize(SIMPLIFY_BRUSH_TOOL_OPTIONS) });
```

A shared option is an ordinary tool option kept under a shared key (`ToolOptions.share`), so the tunings, the step
keys, the last-operation panel, and an options row all read the one size. Each tool reads it held to its own
bounds; every other option stays its own. `BRUSH_SIZE_PX` is the key for a size in screen pixels; a brush sized in
world units needs a key of its own.

The ring cursor a brush shows is `brushRing` in `@weasel-js/cursor`.
