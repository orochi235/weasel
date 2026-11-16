---
'@weasel-js/react': minor
---

`useWindowEvent(type, handler, options)` listens for an event on the window while a component is mounted.

It always calls the handler from the last render.

```ts
useWindowEvent('hashchange', () => setRoute(readRoute()));
useWindowEvent('pointerdown', away, { capture: true, enabled: open });
```

A new handler each render does not re-subscribe; changing `type`, `capture`, `passive` or `enabled` does.

<!-- entry: api -->
