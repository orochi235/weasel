---
'@weasel-js/path-tools': major
---

path-tools' action groups move from its main entry's `…_GROUP` constants to `@weasel-js/path-tools/groups`

```tsx
// before
import { ANCHOR_SELECTION_GROUP } from '@weasel-js/path-tools';
<ActionBar group={ANCHOR_SELECTION_GROUP} />

// after
import * as pathToolsGroups from '@weasel-js/path-tools/groups';
<ActionBar group={pathToolsGroups.anchorSelection} />
```

`ANCHOR_SELECTION_GROUP`, `PATH_EFFECTS_GROUP` and `PATH_OVERLAYS_GROUP` are gone from the main entry; the new one names `anchorSelection`, `pathEffects` and `pathOverlays`. Each is the same string as before.

<!-- entry: breaking api -->
