# @weasel-js/brush

Brushes for weasel tools. A tool's brush size is the option its `ToolOptions.size` names, the one `[`, `]` and
Shift+wheel step. By default each tool keeps its own. This package is for an app that wants one size shared
across its brushes.

```ts
import { createToolOptionValues } from '@weasel-js/core';
import { linkBrushSize } from '@weasel-js/brush';

const values = linkBrushSize(createToolOptionValues(), [smudgeTool, simplifyTool]);
useToolOptionValues(values);
```

`linkBrushSize` wraps the host's own option store, so the tunings, the step keys, the last-operation panel and an
options row all see the shared size with no change of their own. Each tool reads it held to its own bounds; every
other option stays per tool. Link only tools whose sizes measure the same thing.

The ring cursor a brush shows is `brushRing` in `@weasel-js/cursor`.
