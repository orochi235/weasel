---
'@weasel-js/core': patch
---

`<SceneCanvas selectionMode="none">` now blocks every selection write the canvas makes. Before, the adapter it hands its tools could still set the selection, and so could any op batch that selects its result, such as a paste or an ingest. `setSelection` on that adapter, and on the `selection` dep's `adapterMethods`, now does nothing in that mode. The consumer's own `SelectionApi`, passed as the `selection` prop or made with `useSelection({ scene })`, still writes, and the canvas draws what it holds.

`defaultCommitAdapter` takes an optional second argument, a `SelectionApi`'s `adapterMethods`. When it is passed, selection reads and writes go through it rather than the scene. Every built-in action now passes its `selection` dep.

The `CanvasSelectionMode` docs now say what each mode does. `'single'` is a click rule, not a cap: a marquee, lasso, select-all or paste can still select several nodes.
