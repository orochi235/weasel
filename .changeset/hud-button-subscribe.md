---
'@weasel-js/hud': major
---

A HUD button's listeners go through `subscribe(event, handler)`, which returns the unsubscribe; `on` and `off` are gone.

```ts
// before
button.on('press', onPress);
button.off('press', onPress);
// after
const off = button.subscribe('press', onPress);
off();
```

<!-- entry: breaking api -->
