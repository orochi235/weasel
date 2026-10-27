---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Text Along Path draws underline, strikethrough and overline. `textClusters` gives each cluster the decoration rules crossing its slot (`TextCluster.rules`), and a path effect item can carry them as `bands` (`EffectBand`); `textAlongParts` joins alike bands on neighboring items into one ribbon that bends with the path, where the glyphs themselves stay rigid.
