---
'@weasel-js/theme': patch
---

Widen the design-token scale: six font-size ranks in place of two, one
font-weight ladder (300/500/700) shared by both themes rather than two that
disagree, line-height and letter-spacing tokens where there were none, a pill
radius, and a shadow token.

Additive except for two removals. `--wzl-font-weight-light` is gone; use
`--wzl-font-weight-normal`. `--wzl-font-weight-medium` resolves to 500 rather
than 350 under the base theme, so anything that pinned itself to the old value
will render heavier.
