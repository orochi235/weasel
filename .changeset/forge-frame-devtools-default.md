---
'@weasel-js/forge': minor
---

A story's canvases register with the devtools hook in a development build, and `devtools: false` in `defineFrameConfig` turns that off.

`devtools: true` keeps it in a production build too. An app's frame config no longer needs a decorator providing the `devtools` contribution.

<!-- entry: rank=4 new api behavior -->
