---
'@weasel-js/ui': major
---

`BarLayout` is gone; a surface that walks its own nodes passes `barNodeChildren(nodes, { cells, attrs })` to a `Bar` as its children.

`groupBarNodes` and the `BarNode`, `BarLeafNode`, and `BarCell` types move to `@weasel-js/ui/components/PrefsBar`.

```tsx
// before
<BarLayout framed label="Text" nodes={nodes} cells={cells} />
// after
<Bar framed label="Text">{barNodeChildren(nodes, { cells })}</Bar>
```

<!-- entry: breaking api -->
