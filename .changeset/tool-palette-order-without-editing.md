---
'@weasel-js/ui': major
---

`ToolPalette` with no `groupOrder` or `toolOrder` follows its `include` set's order, else the order its tools registered in.

This is breaking: the defaults were editing's `TOOL_GROUP_ORDER` and `BUILTIN_TOOL_IDS`, which `@weasel-js/ui` no longer depends on. A canvas's own registry already lists the kit's tools in that order; a palette over another registry that wants it passes them:

```tsx
import { BUILTIN_TOOL_IDS, TOOL_GROUP_ORDER } from '@weasel-js/editing';

<ToolPalette tools={tools} groupOrder={TOOL_GROUP_ORDER} toolOrder={BUILTIN_TOOL_IDS} />
```

<!-- entry: breaking behavior -->
