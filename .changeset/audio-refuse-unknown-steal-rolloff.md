---
'@weasel-js/audio': patch
---

`createAudioEngine` throws a `RangeError` on an unknown `steal` policy, and `setListener` on an unknown `rolloff`, rather than running them as `'oldest'` and `'inverse'`.

<!-- entry: fix -->
