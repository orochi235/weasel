---
'@weasel-js/core': patch
---

The text-edit overlay now honors `verticalAlign`. `TextEditScreenPose` gains an optional `verticalAlign`, and `useSceneTextEdit` fills it from the node (`data.verticalAlign`, or `getVerticalAlign`), so editing a center- or bottom-aligned text node keeps its text where the canvas drew it instead of jumping to the top of the box. The overlay re-measures its own height as you type, so added lines grow a bottom-aligned node upward. Additive: a pose without `verticalAlign` places exactly as before.
