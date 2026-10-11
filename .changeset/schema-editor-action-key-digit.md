---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: an action whose key starts with a digit, such as `3d.toggle`, can be dragged in from the Actions list. Its pref's key is now `_3dToggle`; before, the key was refused and the drop did nothing.
