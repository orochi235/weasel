---
'@weasel-js/storage': minor
'@weasel-js/editor': patch
---

`downloadBlob` and `pickFile` are exported from `@weasel-js/storage`, so code that does not take the editor can save and open files.

`@weasel-js/editor` still exports both, as the same functions.

<!-- entry: api -->
