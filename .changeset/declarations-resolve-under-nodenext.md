---
'@weasel-js/ui': patch
'@weasel-js/hud': patch
'@weasel-js/devtools': patch
'@weasel-js/prefs-editor': patch
---

ui, hud, devtools, and prefs-editor's declarations resolve under `moduleResolution: NodeNext`, so their types no longer read as `any` there.

<!-- entry: fix -->
