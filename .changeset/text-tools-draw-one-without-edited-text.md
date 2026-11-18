---
'@weasel-js/text-tools': major
---

`drawOneEditing` is `drawOneWithoutEditedText`: it draws every node but drops the edited node's text.

```ts
// before
const drawOne = drawOneEditing(editingId);
// after
const drawOne = drawOneWithoutEditedText(editingId);
```

<!-- entry: breaking api -->
