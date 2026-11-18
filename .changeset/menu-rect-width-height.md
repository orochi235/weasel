---
'@weasel-js/menu': major
---

`MenuRect` and `MenuSize` name their size `width` and `height`, as the DOM's `DOMRect` and geom's `Rect` do.

`placeMenu`, `placeMenuUnder`, `placeSubmenu`, a controller's `setPanel` and an open request's `under` take the new fields.

```ts
// before
const at = placeMenu({ w: 180, h: 240 }, anchor, { x: 0, y: 0, w: innerWidth, h: innerHeight });
// after
const at = placeMenu({ width: 180, height: 240 }, anchor, { x: 0, y: 0, width: innerWidth, height: innerHeight });
```

<!-- entry: breaking api -->
