---
'@weasel-js/core': minor
'@weasel-js/editing': minor
---

`@weasel-js/core/groups` and `@weasel-js/editing/groups` name the kit's action groups, for `<ActionBar group>`

```tsx
import * as groups from '@weasel-js/editing/groups';
<ActionBar group={groups.history} />
<ActionBar group={groups.align} />
```

Core's entry has `history`, `viewport`, `presentation`, `anchors`, `path` and `tool`. Editing's re-exports those beside its own `clipboard`, `edit`, `structure`, `nudge`, `insert`, `align`, `distribute`, `flip`, `reorder` and `pathfinder`; a package that does not use editing imports `@weasel-js/core/groups`. Each is the string its actions already carried, so `<ActionBar group="history" />` still works.

<!-- entry: api -->
