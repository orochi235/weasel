---
'@weasel-js/svg': patch
'@weasel-js/lottie': patch
---

The CSS, SMIL and Lottie writers write `easeInBounce`, `easeOutBounce` and `easeInOutBounce` exactly, as a key at each contact and peak eased by a quadratic bezier, rather than as `linear()` points within 0.001.

<!-- entry: behavior data -->
