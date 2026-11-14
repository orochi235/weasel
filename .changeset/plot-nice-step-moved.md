---
'@weasel-js/plot': major
---

`niceStep` is no longer exported from `@weasel-js/plot/scales`; import it from `@weasel-js/geom`, which rounds the same way.

```ts
// before
import { niceStep } from '@weasel-js/plot/scales';
// after
import { niceStep } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
