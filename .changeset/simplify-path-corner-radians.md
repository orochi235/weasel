---
'@weasel-js/geom': major
---

`simplifyPath`'s `cornerAngle` is in radians, as every other angle geom takes; the default is unchanged at 40°.

```ts
// before
simplifyPath(path, 0.5, { cornerAngle: 30 });
// after
simplifyPath(path, 0.5, { cornerAngle: 30 * DEG_TO_RAD });
```

<!-- entry: breaking api -->
