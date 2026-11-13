---
'@weasel-js/core': major
'@weasel-js/editor': patch
---

A double-click on text opens it through the `editTextAt` action, so a host's `useSceneTextEdit` needs no `onDoubleClick` handler.

`useSceneTextEdit` no longer returns `onDoubleClick`, and `TextEditDoubleClick` is gone. The `textEdit` feature (part of `edit`) binds the double-click to `editTextAt`, which opens what the editor's new `textAt(world)` names and declines where the double-click names a group, as path edit does. A canvas inside a `useSceneTextEdit` container answers the `textEdit` dep with that editor, so `TextEditDepPublisher` is only needed for a container that does not hold the canvas. A `TextEditDep` you write yourself now has `textAt`.

```tsx
// Before
const edit = useSceneTextEdit(scene, host);
<div ref={setHost} onDoubleClick={edit.onDoubleClick}>
  <SceneCanvas scene={scene} features={['edit']}>
    <TextEditDepPublisher edit={edit} />
  </SceneCanvas>
</div>

// After
const edit = useSceneTextEdit(scene, host);
<div ref={setHost}>
  <SceneCanvas scene={scene} features={['edit']} />
</div>
```

<!-- entry: rank=10 breaking api -->
