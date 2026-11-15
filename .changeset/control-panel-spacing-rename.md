---
'@weasel-js/labkit': major
---

`ControlPanel` takes `spacing="tight" | "normal" | "loose"` in place of `density`, matching the property panel it draws.

```tsx
// before
<ControlPanel density="tight" … />
// after
<ControlPanel spacing="tight" … />
```

<!-- entry: breaking api -->
