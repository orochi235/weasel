---
'@weasel-js/audio': patch
---

`createAudioEngine` takes a `random` option, the uniform source that picks where in its loop a noise voice starts (default `Math.random`). `renderEngine` from `@weasel-js/audio/testing/renderEngine` passes engine options through, so an offline render of noise voices can be made repeatable.
