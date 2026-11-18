---
'@weasel-js/gestures': major
---

The route grammar's double-click gesture is `doubleClick`, matching its spec kind; `dblTap` no longer parses.

```ts
// before
routeToSpec('[*:*] dblTap');
// after
routeToSpec('[*:*] doubleClick');
```

<!-- entry: breaking api -->
