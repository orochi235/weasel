---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Folds several duplicated pieces of weasel-ui into one definition each. No component changes its look or behavior.

- The transparency checker under swatches, wells, and gradient stops is one background layer, built in `components/checker.module.css`; the `--wzl-checker-a` token's description points there instead of spelling out the gradient to paste.
