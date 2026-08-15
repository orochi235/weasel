---
'@weasel-js/core': patch
---

Tool authoring moved out of `routing/` and onto the main barrel. `defineTool`,
`defineViewportTool`, `ToolDef`, `ViewportToolDef` and `ToolKeybinding` now come
from `@weasel-js/core`:

```ts
import { defineTool, type ToolDef } from '@weasel-js/core';
```

**This is a breaking change for anyone importing them from
`@weasel-js/core/routing`.** That subpath keeps the route grammar (`parseRoute`,
`formatRoute`, `describeRoute`, the gesture descriptors) and the reflection
consumers (`buildRouteRegistry`, `findConflicts`) — it is now only the surface
that *reads* routes back, matching its name.

Finishes Phase 6 of the 2026-05-12 declarative-routing work. Source layout
follows: the factory and its `ToolDef` types sit at the top of `src/tools/`
alongside `useTools` and `useKeybindings`, with `routing/types.ts` renamed
`routeTypes.ts` to clear the existing `tools/types.ts`. Behavior and runtime
contract are unchanged.
