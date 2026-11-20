---
'@weasel-js/core': major
'@weasel-js/path-tools': major
---

A slice's commit is set on the tool or action, `useSliceTool({ commit })` or `createSliceAction({ commit })`, not through a `slice` dep.

This is breaking. The `slice` dep, `SliceDep` and `useSliceDepSource` are gone, and `<SceneCanvas>` no longer publishes one. The default commit is path-tools' `slicePaths(cut, deps)`, which cuts every path the cut crosses as before; it reads the deps in `SLICE_PATHS_REQUIRES`. A custom commit names the deps it reads in `requires`, and gets them as its second argument. `OpsApplier` is still exported from core.

```tsx
// before
useDepSource('slice', () => ({ commit: (cut) => cutMine(cut) }));
const slice = useSliceTool();
// after
const slice = useSliceTool({ commit: (cut, deps) => cutMine(cut, deps.scene), requires: ['scene'] });
// or, for the action alone
<SceneCanvas actions={{ slice: createSliceAction({ commit, requires: ['scene'] }) }} />
```

<!-- entry: breaking api -->
