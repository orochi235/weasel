---
'@weasel-js/plot': major
---

`plotEditing` returns one entry for `ambient`, its handle layer inside, instead of a layer to register and a contribution.

```tsx
// Before
const { layer, contribution } = plotEditing({ scene });
useEffect(() => canvas?.registerLayer(layer), [canvas, layer]);
<SceneCanvas ambient={[contribution]} />

// After
const editing = useMemo(() => plotEditing({ scene }), [scene]);
<SceneCanvas ambient={[editing]} />
```

<!-- entry: rank=5 breaking api -->
