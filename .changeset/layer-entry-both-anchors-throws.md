---
'@weasel-js/core': major
---

A custom layer entry in `layers` that sets both `after` and `before` throws.

This is breaking: such an entry used to be placed by `after`, with `before` ignored. Keep the anchor you meant and drop the other.

```ts
// before: placed after the grid
layers={{ hud: { layer, after: 'grid', before: 'scene' } }}
// now
layers={{ hud: { layer, after: 'grid' } }}
```

<!-- entry: breaking behavior -->
