---
'@weasel-js/gestures': patch
'@weasel-js/history': patch
'@weasel-js/modes': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
---

Declare `sideEffects` on the five packages that were missing it, so bundlers
can tree-shake unused exports instead of assuming every module does work at
import time.

`gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
global or run anything at module scope. `labkit` is `["*.css"]`, matching
`ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
hand, and the page then renders unstyled with no error anywhere.
