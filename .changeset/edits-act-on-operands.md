---
'@weasel-js/core': major
---

Editing actions act on a new `operands` dep, the selection by default, so a host can point an edit at any list of ids.

This is breaking for code that runs kit actions or builds their deps by hand. Delete, cut and copy, duplicate, group, nudge, reorder, align, distribute, flip, move, resize, rotate, clone, insert, place, ingest, the paint actions, Transform Again and the Pathfinder actions now declare `operands` in `requires` and read it where they read `selection`, and `commitOps` hands `select` to it and, with no `applyOps`, commits through it, so an action of your own that calls `commitOps` declares `operands` where it declared `selection`. `useStandardDeps` answers `operands` with the registry's `selection` unless given `operands`, so a `<SceneCanvas>` behaves as before. Selecting actions (select all, clear selection, Escape, select deep, the context menu, marquee and lasso) still read `selection`.

```tsx
import { operandList } from '@weasel-js/core';
// act on b and c, whatever is selected
useDepSource('operands', () => operandList([b, c]));

// a test or a host calling an action directly
deleteAction.invoker.run({ scene, operands: operandList(ids) }, undefined);
```

`selectionMethods` is now `operandMethods`, taking an `OperandsDep`; `IngestCtx.selection` is `IngestCtx.operands`; `useBooleansAdapterSource`, `useSliceDepSource` and `usePathLeafDepSources` take an `OperandsDep` where they took a `SelectionApi`, and `<SceneCanvas>` hands them `useLiveOperands()`, which reads the registry's `operands` on each call.

<!-- entry: rank=10 breaking api -->
