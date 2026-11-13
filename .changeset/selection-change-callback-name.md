---
'@weasel-js/ui': major
---

`LayerList`, `Timeline`, `BandEditor` and `EffectList` report a selection through `onSelectionChange`, as `Tree`, `Select` and `ComboBox` do.

```tsx
// before
<LayerList items={items} selectedIds={ids} onSelect={setIds} />
// after
<LayerList items={items} selectedIds={ids} onSelectionChange={setIds} />
```

`useSceneLayerList()` returns `onSelectionChange` in place of `onSelect`.

<!-- entry: breaking api -->
