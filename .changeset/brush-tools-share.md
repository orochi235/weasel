---
'@weasel-js/path-tools': patch
---

`useSmudgeBrushTool` and `useSimplifyBrushTool` take a `share`, laid over their options' shares, so `@weasel-js/brush`'s `shareBrushSize` can give them one brush size.
