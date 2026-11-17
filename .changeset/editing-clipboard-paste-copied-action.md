---
'@weasel-js/editing': major
---

`clipboardPasteEventAction` is `clipboardPasteCopiedAction`, named for what it pastes: nodes a kit canvas copied.

Its id is still `clipboard.pasteEvent`.

```ts
// before
useAction(clipboardPasteEventAction);
// after
useAction(clipboardPasteCopiedAction);
```

<!-- entry: breaking api -->
