---
'@weasel-js/p-touch': patch
---

`.lbx` objects carried by `lbxObjects` now honor the opacity above them: at alpha 0 they are left out, and under partial opacity they are reported in `skipped`, since an `.lbx` object cannot be translucent.

A carried object under a clip, which is every node inside a clipping container, used to vanish without a word. It now goes in the file when it lies wholly inside axis-aligned rect clips, with the clipped paint around it rasterized in order; otherwise it is reported in `skipped`, as is one under a group with an effect, isolate, color matrix or blend.
