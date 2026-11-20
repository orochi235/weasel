---
'@weasel-js/core': major
'@weasel-js/editing': major
---

Which layout container takes a drop is `move`'s `layoutDropTarget` param, set through `tune`, not `<SceneCanvas layoutDropTarget>`.

This is breaking. The `<SceneCanvas>` prop and `LayoutDep.dropTarget` are gone, and `useLayoutDepSource` takes `(scene, reflow?)`. The modes and the `'innermost'` default are unchanged, and the param decides both the drag-time reflow preview and the commit.

```tsx
// before
<SceneCanvas layoutDropTarget="topmost" />
// after
<SceneCanvas tune={{ move: { params: { layoutDropTarget: 'topmost' } } }} />
```

<!-- entry: breaking api -->
