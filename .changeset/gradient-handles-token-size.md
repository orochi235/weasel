---
'@weasel-js/ui': patch
---

`GradientHandles` sizes its handles from `--wzl-handle-size-lg`, the token a `MeshHandles` corner uses, where it drew a literal 7px radius. At the default theme a gradient handle is 10px across, down from 14px. The size was chosen on an agent's judgment and has not been looked at in a browser.
