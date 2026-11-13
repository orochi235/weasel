---
'@weasel-js/labkit': major
---

A boolean config leaf asks for a switch with `.switch()`, the control it sets; `f.boolean(…).toggle()` is gone.

`.toggle()` stays on `f.enum`, where it asks for segments.

```ts
// before
snap: f.boolean(true).toggle(),
// after
snap: f.boolean(true).switch(),
```

<!-- entry: breaking -->
