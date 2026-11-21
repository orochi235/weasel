---
'@weasel-js/renderer': patch
---

`renderIdsAsync` and `readPixels` reject their promise when the read fails. A rect outside the canvas and a failing frame both arrive as the rejection.

<!-- entry: fix behavior -->
