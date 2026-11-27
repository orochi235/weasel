---
"@weasel-js/ui": minor
---

`TileStacks` and `TileShelf` chart items as isometric tiles that one hover traces across charts, drawn with the new `IsoTile`.

```tsx
const [traced, setTraced] = useState<string | null>(null);

<TileStacks
  aria-label="Findings per pass"
  columns={[[{ key: 'd1', tone: s.new }], [], [{ key: 'd1', tone: s.again }, { key: 'd2', tone: s.new }]]}
  span={10}
  trailing="≈ 3 not found yet"
  traced={traced}
  onTrace={setTraced}
  onPick={(key) => select(key)}
/>
<TileShelf
  aria-label="Fix groups"
  groups={[{ key: 'b1', label: 'b1', items: [{ key: 'd1', tone: s.fixed, marked: true }] }]}
  traced={traced}
  onTrace={setTraced}
/>
```

An item is `{ key, tone, title }`, where `tone` is a class that sets `--tile`. `TileStacks` stacks each column's items bottom to top along a numbered axis, with a patch for an empty column and an optional trailing label. `TileShelf` stands items on end in labeled groups, with a dot over a `marked` one. While a key is traced, its tiles keep their tones and the rest fade to `--tile-faded`; the shelf keeps the traced tile's whole group in color and outlines the tile. The traced tile carries `data-traced`, so a tone can restyle it. Without `traced`, each chart keeps its own trace.

<!-- entry: rank=5 new api -->
