---
'@weasel-js/p-touch': patch
---

`.lbx` objects carried by `lbxObjects` now honor the opacity above them: at alpha 0 they are left out, and under partial opacity they are reported in `skipped`, since an `.lbx` object cannot be translucent.
