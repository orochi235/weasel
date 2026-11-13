---
'@weasel-js/pdf': minor
---

`exportRegionsPdf` writes regions of a scene as the pages of one PDF, and `registerPdfExport()` makes it core's `pdf` export format.

Each region is a page at 0.75 points per world unit, labeled with the region's `name`. Both come from the new `@weasel-js/pdf/export` entry, which takes `@weasel-js/core` as an optional peer; the main entry still needs neither core nor React.

```ts
import { registerPdfExport } from '@weasel-js/pdf/export';

registerPdfExport();
const blob = await exportPages(scene, placedPagesOf(scene), 'pdf', { title: 'Drawing' });
```

<!-- entry: rank=5 new api -->
