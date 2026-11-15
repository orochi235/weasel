---
'@weasel-js/core': minor
---

`pathNode(id, path, data, place)` builds a path mark the way the shape tools store one: `data.path` under a pose at the path's bounds.

```ts
createScene({
  systemLayers: [{ id: 'default' }],
  initial: [pathNode('leaf', 'M100 200 C140 110 260 90 340 120 Z', { fill: { paint: solid('#a8d5a2') } })],
});
```

`path` is a built path or SVG path data. `place` takes `layer` (default `'default'`), `parent`, `rotation`, a `pose` to draw the path through instead of its bounds, and the stated node fields such as `pickable`.

<!-- entry: api -->
