---
'@weasel-js/prefs': patch
---

A split pref read under `weights` with an infinite weight reads as the member that weight names instead of `NaN`.

Several infinite weights, including nested weights whose product overflows, share the blend equally and the finite ones drop out. Where nested weights underflow to nothing, every member shares the blend equally.

<!-- entry: fix -->
