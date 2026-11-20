---
'@weasel-js/prefs-editor': patch
---

`AssetEditor` ignores what an `onChangedAssets` callback returns, rather than calling it as an effect cleanup.

<!-- entry: fix -->
