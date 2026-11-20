---
'@weasel-js/plot': minor
---

`xyScales` maps an xychart's data to positions with no box, so a 3D host can lay its axes along any direction.

`xyScales(data, valueRange, categoryRange)` returns `{ value, category, slots, slotWidth }`: the value scale, the category axis's bands or numbers, and each row's center and bar share along it. `compileXyChart` lays out its plot through it.

```ts
const { value, slots } = xyScales(data, [0, depth], [-width / 2, width / 2]);
const barTop = value.position(data.series[0].values[2]);
```

<!-- entry: rank=5 new api -->
