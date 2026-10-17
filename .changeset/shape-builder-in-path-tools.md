---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

The shape builder lives in `@weasel-js/path-tools`, in a directory of its own, rather than in core: import `useShapeBuilderTool`, `planShapeBuilder`, `facesAlong` and their types from there, and mount the tool with `<SceneCanvas tools>`. It carries its own actions, so it needs no preset. Its behavior is unchanged, and core has no code of its own for it.

Core opens its Boolean pipeline to an operation of the caller's own, which is what the shape builder now runs on: `resolveBooleanOperands(adapter, opts)` answers the selection's operands back to front, resolved as the built-in operations resolve them (text outlines, a counted stroke's region and the paint it leaves), and `commitBooleanPieces(adapter, operands, pieces, label)` replaces them with the caller's pieces as one undo step, each minted from the source it names and stacked in that source's slot. `PATHFINDER_STROKES`, what a stroked operand gives the Pathfinder actions, is exported, and `@weasel-js/core/test-seams` adds `rootsTreeForTests`, the flat tree of a fake adapter.
