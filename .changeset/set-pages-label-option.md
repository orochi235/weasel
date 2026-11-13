---
'@weasel-js/core': major
---

`setPages` takes its undo label in its options, as `addPage`, `removePage` and the other page edits do.

The label is optional and defaults to "Set pages".

```ts
// before
setPages(scene, doc, 'Pages', { descriptor });
// after
setPages(scene, doc, { label: 'Pages', descriptor });
```

<!-- entry: breaking api -->
