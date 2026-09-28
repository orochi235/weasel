---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Types that public exports already referenced can now be imported by name from `@weasel-js/core`: `Overlay`, `SHAPE_KINDS`, `ShapeKindDescriptor`, `ShapeKindsWhere`, `KitInsertShape`, `ShaderProgram`, `ToolPrefBase`, `BaseFeature`, `MeshBox`, `PenContinuation`, `SerializedLayer`, `SelectionStore`, `Polyline`, `Scale2`, `WeaselProviderProps`, `HitTestView`, `StyleToggle`, `DEFAULT_INK`, `CURSOR_ANGLE_STEPS`, `CURSOR_MAX_CSS_PX`, and the dispatch-record types `Dispatcher.explain` returns (`DispatchRecord` and its parts, also still on `@weasel-js/core/routing`). A node's `derivePath` / `derivePose` now have named types, `DerivePathFn` and `DerivePoseFn`, which `unionOfChildrenVia` returns.

Breaking for test code: `_resetPaintKindsForTests` and `_resetMarkersForTests` moved off core's barrel to a new `@weasel-js/core/test-seams` entry, and `@weasel-js/routing` no longer exports its internal dispatcher helpers `publishLiveDispatch`, `filterEligible` and `preferContextual`.
