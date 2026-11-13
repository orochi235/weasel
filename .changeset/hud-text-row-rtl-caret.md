---
'@weasel-js/hud': patch
'@weasel-js/core': minor
---

A hud menu's text row puts the caret, the selection and a click where right-to-left text is drawn, once a bidi engine is registered.

A selection that crosses a change of direction is drawn as one band per stretch. `@weasel-js/core` now exports `registeredBidi`, the engine `registerBidi` was last given.

<!-- entry: fix api -->
