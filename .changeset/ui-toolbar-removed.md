---
'@weasel-js/ui': major
---

`Toolbar` is gone; a `Bar` with `label` and `roving` takes its place, and `ToolbarButton` is `ActionButton`.

`aria-label` becomes `label`, `framed` becomes `framed="band"`, and `Toolbar.Title` becomes `lead="label"`, which inside a movable `ToolbarDock` is also the bar's move handle. A `Bar` does not rove unless asked.

```tsx
// before
<Toolbar aria-label="Trial actions" size="sm" framed>
  <Toolbar.Title>My Trial</Toolbar.Title>
  <Toolbar.Group><Toolbar.Button onClick={undo}>Undo</Toolbar.Button></Toolbar.Group>
</Toolbar>
// after
<Bar label="My Trial" lead="label" roving size="sm" framed="band">
  <Bar.Group><ActionButton label="Undo" onPress={undo} /></Bar.Group>
</Bar>
```

<!-- entry: breaking api -->
