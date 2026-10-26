---
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/routing": patch
---

`ToolPalette` now lays its tools out in a natural order by default: the selection tools first, then the hand, then the tools that make things (shapes, pen and pencil, text), and the slice tool last. Core's new `TOOL_GROUP_ORDER` names the group order, and `BUILTIN_TOOL_IDS` (now listed group by group, so the lasso follows select) orders the tools within each group; a palette given `groupOrder`, or the new `toolOrder` prop, follows that instead. Groups and tools neither order names keep their registration order after the named ones. `BUILTIN_TOOL_GROUPS` lists the built-in tool sets in that order. The slice tool's presentation group is now `page`, matching `PAGE_TOOLS`, so it gets a group of its own rather than sitting among the shapes.
