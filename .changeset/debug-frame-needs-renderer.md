---
'@weasel-js/core': patch
---

A canvas with no WebGL2 context to paint through, or one lost for now, leaves the debug overlay's last recorded frame as it was instead of recording a frame it never painted.

<!-- entry: fix -->
