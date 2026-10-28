---
'@weasel-js/ui': patch
---

`ToolPalette` takes `carryTool(tool)`, which makes each tool's button the source of an in-app carry: a press carries the `CarryPayload` it returns over the page, to any canvas whose bindings take its `type`, such as `@weasel-js/diagram`'s item drop under `DIAGRAM_ITEM_CARRY`. A press that moves 4 pixels or less still picks the tool; one that moves further carries, and its click picks nothing. A tool it returns `null` for keeps a plain button. A carrying button takes `touch-action: none`, so a touch drag carries rather than scrolls. `ToolButton` takes `onPointerDown`. This adds API.
