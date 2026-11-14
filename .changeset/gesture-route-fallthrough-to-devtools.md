---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`GestureRoute`, `gestureRouteSegments` and `FallthroughDiagram` are no longer exported from `@weasel-js/ui` or `@weasel-js/labkit/weasel-ui`; they now live inside `@weasel-js/devtools`'s panel.

The `@weasel-js/ui/components/GestureRoute` and `@weasel-js/ui/components/FallthroughDiagram` subpaths are gone too. The devtools panel's bindings list and dispatch trace still draw both; code that drew a route or a dispatch record itself can build the same strip from `Powerline`, which stays in `@weasel-js/ui`.

```tsx
// before
import { GestureRoute } from '@weasel-js/ui';
<GestureRoute route="[initial] drag => node +shift" />
// after: mount the devtools panel, or draw the segments with Powerline
import { Powerline } from '@weasel-js/ui';
```

<!-- entry: breaking api -->
