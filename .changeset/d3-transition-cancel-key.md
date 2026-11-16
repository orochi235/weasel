---
'@weasel-js/d3': major
---

A transition whose name or node id holds `:` no longer cancels another node's transition; `transitionCancelKey` builds the new keys.

A key assembled by hand as `d3-transition:<name>:<nodeId>` no longer matches. Build it instead:

```ts
import { transitionCancelKey } from '@weasel-js/d3';

animator.cancelKey(transitionCancelKey('move', nodeId));          // the pose tween
animator.cancelKey(transitionCancelKey('move', nodeId, 'color')); // a custom tween
```

<!-- entry: breaking api fix -->
