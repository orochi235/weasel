---
'@weasel-js/routing': patch
---

Options of a tool whose id has a dot, such as `path.brush`, read back from a prefs store.

`toolOptionsPrefs` nests the tool's group a level per dot, where `prefsToolOptionValues` reads it.

`toolOptionsPrefs` throws, naming the option, for an option key or shared key with a dot, and for a tool whose options would land inside another tool's option.

<!-- entry: fix -->
