---
'@weasel-js/ui': major
---

`ToolGroup` lays its buttons along the run it sits in and no longer takes `orientation`.

Inside a `ToolPalette` it follows the palette's `orientation`, as before. On its own it is a row, which was `orientation="horizontal"`; for a column, set the run around it.

```tsx
// before
<ToolGroup orientation="vertical">{buttons}</ToolGroup>
// after
<RunScope orientation="vertical"><ToolGroup>{buttons}</ToolGroup></RunScope>
```

<!-- entry: breaking api -->
