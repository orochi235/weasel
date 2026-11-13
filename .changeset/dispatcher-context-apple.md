---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`DispatcherContext.isMac` is `DispatcherContext.apple`, the name every matcher and capture function gives the flag saying `mod` is Command.

```ts
// Before
dispatcher.resolveAll(event, { actions, depRegistry, activeToolId, hotkeyStack, entriesById, isMac: isApplePlatform() });

// After
dispatcher.resolveAll(event, { actions, depRegistry, activeToolId, hotkeyStack, entriesById, apple: isApplePlatform() });
```

<!-- entry: breaking api -->
