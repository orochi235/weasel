---
"@weasel-js/ui": patch
---

A straight `Slider` works under a rotated ancestor. A press or drag is mapped back through every transform above the rail, so under `rotate(90deg)` a press at three quarters of the rail reads 75 rather than 50. The sizes a track painter and a custom thumb are handed are the untransformed ones, in the px they draw in, and readouts below the thumbs stagger by where they sit along the rail rather than by their on-screen boxes.
