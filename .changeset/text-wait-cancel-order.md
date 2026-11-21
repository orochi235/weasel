---
'@weasel-js/ui': patch
---

A string property field with `inputWaitMs` sends Escape's restored text through `onInput` before `onCancel`, not after it.

<!-- entry: fix -->
