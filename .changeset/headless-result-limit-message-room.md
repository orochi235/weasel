---
'@weasel-js/headless': patch
---

A raster host refuses by name any render whose result would not fit the protocol message that carries it to Node.

`MAX_RESULT_BYTES` is 401 866 734, leaving 1 MiB for that message.

<!-- entry: fix -->
