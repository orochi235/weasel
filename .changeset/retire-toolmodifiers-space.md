---
'@weasel-js/core': patch
---

Remove `space` from `ToolModifiers`.

Breaking for anyone constructing a `ToolModifiers` literal: the field is gone and an object still carrying it is now an excess property. Reading `ctx.modifiers.space` was already meaningless — `Canvas` hardcoded `false` at both construction sites, so the field never once reported a held space bar.

Nothing needed it. Space-for-hand is armed by the tool's own `hotkey: 'space'` declaration, which routes through `tool.offhand` and the dispatcher's key-held lifecycle and never consults `ToolCtx`. The field existed for a mid-gesture read that no tool ever wrote or performed.
