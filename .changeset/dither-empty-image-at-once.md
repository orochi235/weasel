---
"@weasel-js/dither": patch
---

`ditherPixels` and `protectMask` answer at once for an image with no pixels, such as one 0 wide and 2³¹ tall, where they walked every empty row: a protect mask with a rect over that image took about 30 seconds, and Bayer and both error-diffusion methods took longer the taller the image.
