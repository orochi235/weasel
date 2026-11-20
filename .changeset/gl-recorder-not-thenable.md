---
'@weasel-js/renderer': patch
---

A `createGLRecorder` context can be awaited or resolved from a promise: it no longer answers `then` or `toJSON`.

It also records `valueOf` and the other names `Object.prototype` carries, like any other method.

<!-- entry: fix -->
