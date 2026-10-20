---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
---

Tool sets: a `ToolSet` names a group of tool ids and other sets as one unit (`toolSet`, `toolIdsOf`, `withoutTools`, `toolSetHas`). `<SceneCanvas defaultTools>`, a preset's `tools`, and `ToolPalette`'s `include` each take sets. Core exports one per family, `SELECT_TOOLS`, `VIEW_TOOLS`, `SHAPE_TOOLS`, `DRAW_TOOLS`, `TYPE_TOOLS`, `PAGE_TOOLS` and `RIG_TOOLS`, with `BUILTIN_TOOLS` over them all; `BUILTIN_TOOL_IDS` is derived from it, and a shape kind's new `family` field says which set names it. `@weasel-js/path-tools` exports `WARP_TOOLS`, `RESHAPE_TOOLS`, `PATH_TOOLS_TOOLS`, and `usePathToolsTools()`, which builds every one of its tools keyed by id.
