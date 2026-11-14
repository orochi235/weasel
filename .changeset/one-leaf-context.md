---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

Every params surface hands its renderers one `LeafContext`, and `PrefSchemaEditor` takes one `renderers` map.

`PrefRenderContext` and `PropertyRenderContext` are now `LeafContext`; `PrefRenderer`, `PropertyRenderer`, and labkit's `ControlRenderer` are now `LeafRenderer`. Every context carries `mixed`, `each` (one value per target), `update`, `source` (the surface's `PrefsSource`), and `reset` while the leaf differs from its reset. A selection's `ctx.valueAt(path)` is now `ctx.source.valueAt(path)`, which also returns `each`. `PrefSchemaEditor`'s and `AssetEditor`'s `propertyRenderers` is gone: pass those renderers in `renderers`.

```tsx
// before
const swatch: PropertyRenderer = (ctx) => <Swatch weight={ctx.valueAt('data.fontWeight').value} />;
// after
const swatch: LeafRenderer = (ctx) => <Swatch weight={ctx.source.valueAt('data.fontWeight').value} />;
```

To draw one leaf outside a surface, as a renderer's test does, build its context with `loneLeafContext(path, leaf, value, setValue)` from `@weasel-js/ui/components/PrefsSource`.

<!-- entry: breaking api -->
