---
'@weasel-js/diagram': major
---

The helper that grows a pose to fit its body's floor is `growToBody`, since it never shrinks one.

`sizeToBody` is renamed `growToBody`; its arguments are unchanged.

```ts
// before
const pose = sizeToBody(at, measureBody(spec, measure));
// after
const pose = growToBody(at, measureBody(spec, measure));
```

<!-- entry: breaking api -->
