---
'@weasel-js/core': minor
---

A group paints its own box from `data.background` and `data.border`, under its children, so a backing or outline needs no mark of its own.

The box is the group's pose. The group's own `clip` does not cut it, and it stays put while a scrolled container's content moves. A group's `data.fill` and `data.stroke` keep their meaning, the paint its children's `'inherit'` takes, and still paint nothing. The selection box counts the border; picking is unchanged. `GroupBoxData` types the two fields:

```ts
scene.add({ kind: 'group', layer, pose, data: { background: { paint: solid('#fbf7ee') }, border: { paint: solid('#d4c4a8'), width: 1 } } });
```

<!-- entry: rank=10 new api visual -->
