---
'@weasel-js/lottie': patch
---

A Lottie trim whose start passes its end draws nothing, as it does in SVG, and warns where moving edges cross.

A trim that never moves is written with `s = e`. Where tracked edges cross at a frame Lottie draws, `onWarn` says so, since Lottie players draw the span between them there.

<!-- entry: fix visual -->
