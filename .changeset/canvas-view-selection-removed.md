---
'@weasel-js/core': major
---

`<CanvasView>` no longer takes `selection` or `selectionOptions`: a view acts on its canvas's editing session, and a view that must select apart is a canvas of its own over an `EditingSession`.

`CanvasView`'s `deps` no longer accepts a `selection` either.

```tsx
// before
<SceneCanvas scene={scene}>
  <CanvasView id="panel" bounds={PANEL} selectionOptions={{ mode: 'multi' }} />
</SceneCanvas>
// after
const session = useEditingSession(scene);
<SceneCanvas scene={scene} />
<SceneCanvas scene={session} selectionOptions={{ mode: 'multi' }} />
```

<!-- entry: breaking api -->
