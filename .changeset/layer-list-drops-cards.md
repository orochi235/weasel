---
'@weasel-js/ui': major
---

`LayerList` draws only rows: `renderBody`, and a layer's `badge` and `tint`, are gone. A list of cards with settings is an `EffectList`.

```tsx
// before
<LayerList items={[{ id: '1', label: 'fill', tint: 0 }]} onReorder={reorder} renderBody={(item) => <Settings item={item} />} />
// after
<EffectList
  items={[{ id: '1', kind: 'fill', name: 'fill', on: true }]}
  kinds={{ fill: { label: 'Fill', color: 0 } }}
  onChange={setItems}
  selected={open}
  onSelectionChange={setOpen}
  renderBody={(item) => <Settings item={item} />}
/>
```

A layer's `title` now only stands in for its label in the row.

<!-- entry: rank=10 breaking api -->
