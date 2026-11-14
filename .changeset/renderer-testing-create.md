---
'@weasel-js/renderer': major
---

renderer's testing helpers are `createGLRecorder` and `createUploadTracker`, spelled as the kit's other factories are.

`makeGLRecorder` (`@weasel-js/renderer/testing/glRecorder`) and `makeUploadTracker` (`@weasel-js/renderer/testing/vertexUploads`) are renamed; their arguments are unchanged.

```ts
// before
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
// after
import { createGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
```

<!-- entry: breaking api -->
