---
'@weasel-js/editing': major
---

Editing's tool sets of every kit tool are `KIT_TOOLS`, `KIT_TOOL_GROUPS` and `KIT_TOOL_IDS`; "builtin" is left to core's own tools.

`BUILTIN_TOOLS`, `BUILTIN_TOOL_GROUPS` and `BUILTIN_TOOL_IDS` are renamed, and `KIT_TOOLS`'s set id is `'kit'`. Core's `BUILTIN_TOOL_IDS` (the hand) keeps its name.

```ts
// before
import { BUILTIN_TOOLS, BUILTIN_TOOL_GROUPS, BUILTIN_TOOL_IDS } from '@weasel-js/editing';
// after
import { KIT_TOOLS, KIT_TOOL_GROUPS, KIT_TOOL_IDS } from '@weasel-js/editing';
```

<!-- entry: breaking api -->
