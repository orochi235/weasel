---
'@weasel-js/svg': major
---

`@weasel-js/svg` no longer re-exports `pathToD` under a second name, `serializePathD`; import `pathToD` from `@weasel-js/geom`.

```ts
// before
import { serializePathD } from '@weasel-js/svg';
// after
import { pathToD } from '@weasel-js/geom';
```

<!-- entry: breaking -->
