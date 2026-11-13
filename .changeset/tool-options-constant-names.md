---
'@weasel-js/path-tools': major
'@weasel-js/rig': major
---

The brush tools' options constants end in `_TOOL_OPTIONS`, as core's `RECT_TOOL_OPTIONS` and `PEN_TOOL_OPTIONS` do.

`SIMPLIFY_BRUSH_OPTIONS` is `SIMPLIFY_BRUSH_TOOL_OPTIONS`, `SMUDGE_BRUSH_OPTIONS` is `SMUDGE_BRUSH_TOOL_OPTIONS` (path-tools), and `WEIGHT_BRUSH_OPTIONS` is `WEIGHT_TOOL_OPTIONS` (rig), named for the `weight` tool.

```ts
// before
import { SMUDGE_BRUSH_OPTIONS } from '@weasel-js/path-tools';
// after
import { SMUDGE_BRUSH_TOOL_OPTIONS } from '@weasel-js/path-tools';
```

<!-- entry: breaking api -->
