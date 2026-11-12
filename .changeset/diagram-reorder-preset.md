---
"@weasel-js/diagram": minor
---

`reorderPreset` and `groupReorderPreset` install a reorder that works beside the `move` feature.

Pass one in `features` rather than `ambient`: its drag is tried ahead of the move's on the same press, and hands off to the move once it leaves `region`.

```tsx
<SceneCanvas features={['pick', 'move', reorderPreset({ slots, region, commit })]} />
```

<!-- entry: api -->
