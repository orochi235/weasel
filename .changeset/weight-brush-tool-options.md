---
'@weasel-js/rig': patch
---

The weight tool's brush size is now a tool option, like the path-tools brushes: `radiusPx` in `WEIGHT_BRUSH_OPTIONS`, stepped by `[`, `]`, and Shift+wheel, kept by the host's `toolOptionValues`, and tuned into both a drag and a click's dab. `useWeightTool` takes a `share`, so `shareBrushSize` from `@weasel-js/brush` can give it the size other brushes share. Its cursor is a ring that size. Breaking: `useWeightTool` and `useRigTools` no longer take `radius`; the default stays 24 screen px.
