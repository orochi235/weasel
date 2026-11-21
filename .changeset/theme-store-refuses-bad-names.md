---
'@weasel-js/theme': patch
---

`httpThemeApi` refuses a theme name the store cannot hold, such as `list`, without sending a request.

`get` throws, and `put` answers `invalid`.

<!-- entry: fix -->
