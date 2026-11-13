---
'@weasel-js/routing': major
---

`Dispatcher.getInFlightHandles()` is gone; walk `dispatcher.inFlight().values()`, the map of handles by gesture id it read from.

```ts
// before
for (const handle of dispatcher.getInFlightHandles()) draw(handle);
// after
for (const handle of dispatcher.inFlight().values()) draw(handle);
```

<!-- entry: breaking api -->
