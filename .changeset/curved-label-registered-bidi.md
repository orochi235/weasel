---
'@weasel-js/ui': patch
'@weasel-js/text': patch
---

`@weasel-js/ui` no longer depends on `@weasel-js/bidi`. `CurvedLabel` now reorders mixed-direction text with the engine given to `registerBidi` from `@weasel-js/text`, the same one text layout uses; with none registered it keeps the text's logical order and warns once if the text holds right-to-left letters. An app showing right-to-left text in a `CurvedLabel` installs `@weasel-js/bidi` and calls `registerBidi(bidi)` once at startup. `@weasel-js/text` now exports `registeredBidi` and `warnRtlWithoutEngine`, which takes the caller's name for its message.
