---
'@weasel-js/core': patch
---

A `modifierHeld` rule now matches on a `<SceneCanvas>`. The canvas reported no modifier key as held, whatever the keyboard said, so a `chromeVisibility` rule or an action's eligibility written with `modifierHeld('shift')` never applied. It now reads the keys held anywhere in the window, a focused text field included, and repaints when one goes down or up.
