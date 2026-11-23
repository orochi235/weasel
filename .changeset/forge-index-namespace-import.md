---
'@weasel-js/forge': patch
---

A story file that imports forge as a namespace (`import * as forge from '@weasel-js/forge'`, then `forge.meta(…)` and `forge.story(…)`) is indexed as a native file, so its other exports are not listed as stories and its viewports are read.

<!-- entry: fix -->
