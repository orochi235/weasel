---
'@weasel-js/core': major
---

Two presets that give one layer slot or one tool id different values throw, unless one of them `refines` the other.

This is breaking: the later preset in `features` used to win without a word. Two presets giving the same value still agree. Where one preset is meant to override another, say so on it:

```ts
const myGrid: FeaturePreset = { id: 'my-grid', refines: ['grid'], layers: { grid: { layer } } };
```

<!-- entry: breaking behavior -->
