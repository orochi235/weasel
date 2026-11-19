---
'@weasel-js/audio': patch
---

An insert chain's `settled()` resolves at once once its bus graph is disposed, even when the dispose came mid-crossfade.

<!-- entry: fix -->
