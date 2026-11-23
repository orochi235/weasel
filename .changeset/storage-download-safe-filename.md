---
'@weasel-js/storage': patch
'@weasel-js/editor': patch
---

`downloadBlob` saves a file under the same name in every browser. Each `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` or control character in the name becomes `-`.

<!-- entry: fix -->
