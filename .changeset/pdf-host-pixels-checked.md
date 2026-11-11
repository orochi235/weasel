---
"@weasel-js/pdf": patch
---

Pixels a host hands back are checked the same way from `readPixels` and from `rasterize`: a bitmap needs a whole
number of pixels each way, at least one, and four bytes for each. An image whose `readPixels` answered a size of 0,
or fewer bytes than its size holds, was written as an image PDF readers refuse, or padded with black; it is now
left out and reported (`image has the wrong number of pixels`), as a raster of the wrong size already was. A
raster of 0 by 0 is reported too.
