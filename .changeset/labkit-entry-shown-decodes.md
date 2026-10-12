---
'@weasel-js/labkit': patch
---

Fixes: `isEntryShown` compared a condition against stored values, where every other reader compares what the leaf's control shows, so a `showIf` over a leaf stored through an `encoding` answered differently on a walk of the schema's shape than in the panel.

Breaking: `isEntryShown(entry, config, schema)` takes the resolved schema as a third argument, `resolveConfigSchema(schema).group`, which it reads each leaf's `encoding` from. Made on an agent's judgment: an optional argument would have kept the undecoded path alive beside the decoded one.
