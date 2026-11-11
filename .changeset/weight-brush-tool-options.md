---
'@weasel-js/rig': patch
---

The weight tool's brush size is a tool option, stepped by `[`, `]` and Shift+wheel like the path-tools brushes.

It is `radiusPx` in `WEIGHT_BRUSH_OPTIONS`, kept by the host's `toolOptionValues` and tuned into both a drag and a click's dab, and the cursor is a ring that size. `useWeightTool` takes a `share`, so `shareBrushSize` from `@weasel-js/brush` can give it the size other brushes share.

Breaking: `useWeightTool` and `useRigTools` no longer take `radius`; the default stays 24 screen px.

<!-- entry: breaking new api -->
