---
'@weasel-js/path-tools': major
---

`DRAW_TOOLS` includes the spiro pen beside the pen and the pencil, as its `draw` palette group already did.

A host that mounts `DRAW_TOOLS` now mounts `spiro` too, so it passes the spiro tool in `tools` (`usePathToolsTools` builds it) or drops it:

```ts
// to keep the pen and pencil alone
const draw = withoutTools(DRAW_TOOLS, 'spiro');
```

<!-- entry: breaking api -->
