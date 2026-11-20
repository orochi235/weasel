---
'@weasel-js/diagram': minor
---

`Router`, `RouteRequest`, `ResolvedRoute` and `Port` take a point type, `Vec2` by default, and `bezierFor` builds the smooth router in any dimension.

`straight` routes points of any type. `bezierFor(components)` takes how to read a point as numbers and back; `bezier` is `bezierFor(VEC2_COMPONENTS)`. `orthogonal` and `avoid` stay on the plane.

```ts
const bezier3 = bezierFor<[number, number, number]>({ of: (p) => p, point: ([x, y, z]) => [x!, y!, z!] });
```

<!-- entry: api -->
