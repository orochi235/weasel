---
'@weasel-js/labkit': major
---

A boolean config leaf asks for a switch with `.switch()`; `f.boolean(…).toggle()` now asks for a toggle button.

A leaf that called `.toggle()` for its switch calls `.switch()`. `.toggle()` on `f.enum` still asks for segments.

```ts
// before: a switch
snap: f.boolean(true).toggle(),
// after
snap: f.boolean(true).switch(),
```

<!-- entry: breaking behavior -->
