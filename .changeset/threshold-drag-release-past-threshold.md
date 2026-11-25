---
'@weasel-js/routing': patch
---

`startThresholdDrag` treats a release past the threshold as the end of a drag, calling `onStart` then `onEnd`, even when no move crossed the threshold first, rather than reporting it as a click.

<!-- entry: fix -->
