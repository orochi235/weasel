---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

The image cache holds a byte budget and drops what it can once a load takes it past. It kept every decoded bitmap, keyed by `src`, until `releaseImage` was called, and the kit never called it. It now holds 256MB of decoded RGBA by default: when a bitmap lands and the total is over, the least recently read images are released along with their GL textures. An image a live renderer drew in its latest frame is never dropped, nor one read since the previous bitmap landed, so a scene showing more than the budget stays over it instead of reloading on every paint. A dropped image loads again on its next read, which shows as one frame of placeholder for an image that scrolls back into view. `setImageCacheBudget(bytes)` is new API, exported from `@weasel-js/renderer` and core's barrel; it returns the previous value, and `Infinity` restores the old behavior. The default and the two exemptions were chosen on an agent's judgment.
