---
'@weasel-js/ui-input': major
---

`spanHold` is `spanClamp`: it moves a span inside bounds, keeping its length, or shortens it to them.

```ts
// before
const shown = spanHold(view, { from: 0, to: duration });
// after
const shown = spanClamp(view, { from: 0, to: duration });
```

<!-- entry: breaking api -->
