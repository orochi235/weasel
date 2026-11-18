---
'@weasel-js/ui': major
---

`ItemList` reports a row's action through `onAction`, where it was `onActivate`, the name `Tree` gives the same event.

```tsx
// before
<ItemList rows={rows} selection="single" onActivate={setChosen} />
// after
<ItemList rows={rows} selection="single" onAction={setChosen} />
```

<!-- entry: breaking api -->
