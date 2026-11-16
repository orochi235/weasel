---
'@weasel-js/text-tools': minor
---

`@weasel-js/text-tools` depends on `@weasel-js/path-tools`, whose anchors `editEffectText` reads in path edit.

`editEffectText` is registered by `textPreset` alone, not by path-tools' `pathEditPreset`: a canvas opens curved text from path edit when it runs both.

<!-- entry: api -->
