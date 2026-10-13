---
'@weasel-js/modes': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Fixes: "is this tool allowed in this mode" had two answers. `ToolPalette` and a tool's activation key allowed a tool when any one of its capability tags was allowed and refused a tool with no tags, while the dispatcher required every tag and let an untagged tool through. A tool tagged `['navigation', 'creates-shapes']` in a mode without `creates-shapes` showed enabled, activated, and then had every binding dropped; an untagged tool was grayed out yet live once active.

Changes behavior, on the dispatcher's rule: a tool or contribution is allowed when the mode allows every one of its tags, and one with no tags is allowed in every mode. So `eligibleForMode`, `eligibleTool`, and `eligibleContribution` now return `true` for an empty tag list and `false` for a list with one disallowed tag, and `ToolPalette` and the activation keys follow. Which rule wins was chosen on an agent's judgment: a tag names something the tool does, so one refused tag refuses the tool.

Adds API: `capabilitiesAllowed(allowed, tags)` in `@weasel-js/modes`, the one predicate the palette, the activation keys, and the dispatcher all ask.
