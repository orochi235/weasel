---
'@weasel-js/core': minor
---

Two canvases can edit one scene apart: `createEditingSession(scene)` and `useEditingSession(scene)` open an editing session with its own selection, previews and scroll offsets over the same document and history.

A session is a `Scene`, so `<SceneCanvas scene={session}>`, a kernel3d world, or an action's `scene` dep takes one. The scene itself is its default session. An edit made through a session records that session's selection, and an undo or redo restores the selection into the session that steps history. See `docs/editing-sessions.md`.

```tsx
const scene = useScene({ systemLayers: [{ id: 'main' }] });
const session = useEditingSession(scene);
<SceneCanvas scene={scene} />
<SceneCanvas scene={session} />
```

<!-- entry: rank=20 new api -->
