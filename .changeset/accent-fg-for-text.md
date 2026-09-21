---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
