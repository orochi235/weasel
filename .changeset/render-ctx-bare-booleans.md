---
'@weasel-js/ui': major
---

Render-context flags drop their `is` prefix: `active`, `locked`, `pinned` and `endpoint`.

This covers `CurveEditor`'s anchor and layer render contexts and `Slider`'s thumb render context.

```tsx
// before
renderAnchor={({ cx, cy, isActive, isPinnedEndpoint }) => …}
// after
renderAnchor={({ cx, cy, active, pinned }) => …}
```

<!-- entry: breaking api -->
