---
'@weasel-js/ui-input': major
---

`spanPlace` is `spanFraction`, matching the `toFraction` of the map `spanMap` builds; it returns a value's fraction along a span.

```ts
// before
const f = spanPlace(view, t);
// after
const f = spanFraction(view, t);
```

<!-- entry: breaking api -->
