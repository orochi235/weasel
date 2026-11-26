---
'@weasel-js/animator': major
---

`spring`, `decay` and `physics` no longer take `add`, `subtract`, `scale` or `magnitude`.

This is a breaking change. Each moves a number, an array of numbers or a plain object of numeric fields itself, and throws for any other value; drop the four helpers from each call. A `to` or `velocity` shaped unlike `from` now throws as well. Coming to rest is measured as a length across the value's numbers, as `Math.hypot` would. A value that is not numbers, such as a color string, needs to be animated as numbers and converted in `onTick`. The animator now needs `@msb235/blits` 1.5.3 or later.

```ts
// before
animator.decay<Pt>({
  from, velocity,
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
  magnitude: (v) => Math.hypot(v.x, v.y),
  onTick,
});
// after
animator.decay<Pt>({ from, velocity, onTick });
```

<!-- entry: rank=10 breaking api -->
