---
'@weasel-js/gestures': minor
---

`heldPointers(element)` readers can `subscribe` to changes in how many pointers are held on the element.

```ts
const held = heldPointers(document.documentElement);
const off = held.subscribe(() => setDown(held.count() > 0));
```

<!-- entry: api -->
