---
'@weasel-js/ui-canvas': major
---

`SelectionPanel` takes `marked` and `onMark`, where it took `selected` and `onSelect`.

They are the rows it marks and a press on a row; `selection` stays the scene's selection it edits.

```tsx
// before
<SelectionPanel scene={scene} selection={selection} selected={rows} onSelect={pick} />
// after
<SelectionPanel scene={scene} selection={selection} marked={rows} onMark={pick} />
```

<!-- entry: breaking api -->
