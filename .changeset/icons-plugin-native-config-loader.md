---
'@weasel-js/icons-plugin': patch
'@weasel-js/icons': patch
---

The plugin's source writes the `.ts` extension on every relative import, so vite's native config loader can load a config that imports it from source. The published bundle is unchanged.
