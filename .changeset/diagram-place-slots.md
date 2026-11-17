---
'@weasel-js/diagram': major
---

The layout helper that turns canonical slots into moves is `placeSlots`, which no longer reads as the iterating `untilSettled`.

`settle` is renamed `placeSlots`; its arguments are unchanged.

```ts
// before
return settle(graph, slots, opts);
// after
return placeSlots(graph, slots, opts);
```

<!-- entry: breaking api -->
