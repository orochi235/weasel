---
'@weasel-js/path-tools': major
---

`pathEditPreview`, which core exported, is path-tools' `createPathEditPreview`, spelled like the other factories.

This is a breaking rename, with no alias. Its arguments are unchanged.

```ts
// before
import { pathEditPreview } from '@weasel-js/core';
const preview = pathEditPreview(dep, id, current);
// after
import { createPathEditPreview } from '@weasel-js/path-tools';
const preview = createPathEditPreview(dep, id, current);
```

<!-- entry: breaking api -->
