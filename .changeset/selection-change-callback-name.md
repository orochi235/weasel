---
'@weasel-js/ui': major
---

`LayerList`, `Timeline` and `BandEditor` report a selection through `onSelectionChange`, as `Tree`, `Select` and `ComboBox` do.

```tsx
// before
<LayerList items={items} selectedIds={ids} onSelect={setIds} />
// after
<LayerList items={items} selectedIds={ids} onSelectionChange={setIds} />
```

`useSceneLayerList()` returns `onSelectionChange` in place of `onSelect`.

<!-- entry: breaking api -->
