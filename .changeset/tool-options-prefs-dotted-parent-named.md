---
'@weasel-js/routing': patch
---

`toolOptionsPrefs` names the group it makes for a dotted tool id's parent segment (`path` for `path.brush`) after that segment, where it used to leave the group untitled when no tool of that id had options.

<!-- entry: fix -->
