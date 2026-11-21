---
'@weasel-js/animator': patch
---

A finished timeline seeked under a backward `animator.setTimeScale` plays back from where it lands.

One seeked to its start stays finished instead of calling `onDone` again.

<!-- entry: fix -->
