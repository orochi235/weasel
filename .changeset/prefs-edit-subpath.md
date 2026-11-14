---
'@weasel-js/prefs': minor
---

New `@weasel-js/prefs/edit`: the model behind a schema editor, with no React and no DOM.

It edits a schema's tree (`addNode`, `moveNodes`, `renameKey`, `copyNodes`, `aliasNodes`) and a leaf's kind and attributes (`changeKind`, `setAttribute`), prints a schema as source and diffs two (`printSchema`, `diffSchemas`), holds a `Workspace` of schema, layout, action, and bundle assets with its `workspaceCodec` and drafts, and lays a condition out as rows and as a flow (`prefConditionFlow`). These are the functions `@weasel-js/ui`'s schema editor used to keep to itself; the condition rows' `leafOf` is `conditionLeafOf` here, beside the kind table's `leafOf`.

```ts
import { addNode, printSchema } from '@weasel-js/prefs/edit';

const next = addNode(schema, null, 'grid', { kind: 'boolean', name: 'Grid', description: '', default: true });
console.log(printSchema(next));
```

<!-- entry: rank=5 new api -->
