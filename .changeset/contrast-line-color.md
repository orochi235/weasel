---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

`contrastLineColor(background, strength)` derives a line color that reads against an arbitrary background — a grid or a rule drawn over a page whose color the document picks, where theme tokens follow the chrome instead. It moves the background `strength` in OKLab lightness away from its nearer end, darker over light and lighter over dark, keeping its hue, so dark and tinted pages get lines that show. Re-exported from `@weasel-js/core`.
