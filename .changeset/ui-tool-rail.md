---
'@weasel-js/ui': minor
---

New `ToolRail`: a toolbar of icon buttons drawn from items, each with its own icon, label, shortcut, active state and press handler.

Items gather into rule-divided runs by `group`. An item with `members` is a stack sharing one button that opens a menu of them; an item with `render` draws anything else in place.

```tsx
<ToolRail
  items={[
    { id: 'brush', group: 'paint', icon: icon('core:pen'), label: 'Brush', active: tool === 'brush', onPress: () => setTool('brush') },
    { id: 'grid', icon: icon('ui:grid'), label: 'Grid', active: grid, onPress: toggleGrid },
  ]}
/>
```

Its frame sits at zero specificity, so a `className` replaces it outright.

<!-- entry: rank=5 new api -->
