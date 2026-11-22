---
'@weasel-js/diagram': major
---

`LayoutAxes` names its axes by index, `0` for x and `1` for y, instead of `'x'` and `'y'`.

The helpers that take an axis take the index too: `extent`, `center`, `packAcross`, `seededOrder` and `forestOf`. `LayoutAxis` (0, 1 or 2) and `PlaneAxis` (0 or 1) name the types, and `coordOf(point, axis)` and `pointOn(axis, along, across)` read and build a point by axis.

```ts
// before
extent(node.bounds, 'x');
if (axes.rank === 'y') { … }
// after
extent(node.bounds, 0);
if (axes.rank === 1) { … }
```

<!-- entry: breaking api -->
