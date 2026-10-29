---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
'@weasel-js/hud': patch
---

Building a text command allocates less. `resolveRuns` sizes its result up front and builds each run with its fields in one literal, `textCommandFromRuns` resolves the style into a reused object through the new `resolveTextStyleInto`, and a HUD text widget keeps its fill and style objects while its color and font hold. Additive: `resolveTextStyleInto(out, style, paint, scale)` from `@weasel-js/text` writes what `resolveTextStyle` returns into `out`, clearing `script`, `lang` and `stroke` when the new resolution has none.
