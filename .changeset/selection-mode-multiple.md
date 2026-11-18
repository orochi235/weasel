---
'@weasel-js/select': major
'@weasel-js/routing': major
'@weasel-js/core': major
'@weasel-js/editing': major
'@weasel-js/ui': major
'@weasel-js/ui-logic': major
'@weasel-js/hud': major
---

The many-at-once selection mode is `'multiple'` everywhere, as React Aria spells it, and a mode prop is `selectionMode`.

`SelectionMode` is `'single' | 'multiple'`, so `useSelection`'s `mode`, `selectionOptions` and `<SceneCanvas selectionMode>` take `'multiple'` in place of `'multi'`. `<ItemList>`'s `selection` prop, `ListModeInput.selection` and the HUD list's `selection` option are `selectionMode`.

```tsx
// before
useSelection({ scene, mode: 'multi' });
<ItemList rows={rows} selection="multi" />
// after
useSelection({ scene, mode: 'multiple' });
<ItemList rows={rows} selectionMode="multiple" />
```

<!-- entry: breaking api -->
