---
'@weasel-js/core': patch
---

The scene's adapter is the only adapter the kit builds. A flat list of items is a scene (`useScene({ items })`), read and written through `useSceneAdapter(scene)` like any other, so the separate array adapter is gone.

**Breaking:**

- `arrayAdapter`, `useArrayAdapter`, and the types `ArrayAdapter`, `ArrayAdapterConfig`, `ArrayPoseTargets`, and `UseArrayAdapterOptions` are removed. Replace `useArrayAdapter({ items, setItems, toPose })` with `useScene({ items })` and `useSceneAdapter(scene, { selection })`. The scene owns the list from then on: read it from `scene`, and what is written through the adapter is undoable. For a store the kit cannot own, write the adapter by hand against the slices its readers take (`docs/adapters.md`), with `createWrittenPoseTarget` for its `poseTarget`.
- The `SceneAdapter` interface is removed. Nothing implemented it: it required a `hitTest` no adapter had. Name the slice a reader takes (`MoveAdapter`, `PoseAnimationAdapter`, …), or `SceneCanvasAdapter` for the whole of what `sceneToAdapter` returns.
- The scene slot always paints the adapter's tree, one canvas layer per scene layer. It no longer falls back to painting `getNodes()` flat for an adapter without `getLayers`, `getNode`, and `getChildren`, and `CanvasProps['adapter']` requires all three. `SceneSlotConfig.objects` still paints a list of your own in place of the tree.
