---
'@weasel-js/path-tools': minor
---

`usePathEditMode` builds a mode registry and a path-edit host that drives it, for `<SceneCanvas modes pathEdit>`.

```tsx
const { modes, pathEdit } = usePathEditMode({ id: 'curve' });
return <SceneCanvas modes={modes} pathEdit={pathEdit} … />;
```

It starts in the path-edit mode on `id` when given one, and takes the host's other options, plus `definitions` for the modes (default `DEFAULT_MODES`).

<!-- entry: api new -->
