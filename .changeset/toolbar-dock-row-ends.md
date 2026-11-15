---
'@weasel-js/ui': minor
---

`ToolbarDock` bars snap to either end of a dock row: dragged into the far half of a row's open length, a bar joins its far end.

A layout lists the bars at a row's far end in a new optional `atEnd`, and a drop or move target takes `end: true` to put a bar there. A row lists its start bars first, then its end bars, and `resolveLayout` reorders a stored row to match. On a bar at the edge of its group, Alt+arrows cross to the row's other end, so Alt+Right on a row's last bar now sends it to the far end where before it did nothing.

```ts
const layout: ToolbarLayout = { docks: { top: [['file', 'edit', 'view']] }, floating: {}, atEnd: ['view'] };
moveBar(layout, 'edit', { dock: 'top', row: 0, index: 1, end: true }); // edit and view at the far end
```

<!-- entry: rank=5 new api behavior -->
