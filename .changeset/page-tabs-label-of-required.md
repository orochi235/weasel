---
'@weasel-js/ui': major
---

`PageTabs` takes the text of each tab from its `labelOf` prop, which is now required.

This is breaking: the default was core's `pageName`, which `@weasel-js/ui` no longer depends on. Pass it to keep the old labels: a page's name, else "Page" and its place.

```tsx
import { pageName } from '@weasel-js/core';

<PageTabs pages={pages} current={current} labelOf={pageName} onSelect={select} />
```

<!-- entry: breaking api -->
