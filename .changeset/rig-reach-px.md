---
'@weasel-js/rig': major
---

The rig tools' pick distance is `reachPx`, as the snap sources and the rest of rig's screen-pixel options name it.

```ts
// Before
useRigTools({ scene, reach: 14 });

// After
useRigTools({ scene, reachPx: 14 });
```

<!-- entry: breaking api -->
