---
'@weasel-js/core': major
---

The `editAnchors` dep answers which anchor of the open path a click lands on: `anchorUnder(world)`.

It returns the flat index of the edited path's anchor within the `targets.anchorClickPx` kit setting's reach of `world`, measured on screen, or -1 off every anchor and with no path open. The member is required, so an `editAnchors` dep built by hand has to provide it:

```ts
const editAnchors: EditAnchorsDep = {
  // ...the other members
  anchorUnder: (world) => myAnchorIndexAt(world), // -1 when no anchor is in reach
};
```

<!-- entry: breaking api -->
