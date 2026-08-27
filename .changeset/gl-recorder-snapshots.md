---
'@weasel-js/core': patch
---

Copy typed-array arguments into `makeGLRecorder`'s call log as they are
recorded. A caller is entitled to reuse the array it uploads from, so storing
the reference recorded a value that later frames overwrote — a test reading
two frames back saw the same numbers twice and passed. Test-only surface.
