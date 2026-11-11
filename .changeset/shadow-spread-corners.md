---
"@weasel-js/renderer": patch
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

A shadow's spread rounds its corners as CSS `box-shadow` does: a corner sharper than the spread stays sharper, so a square box casts a square shadow. `dropShadowLayers` and `dropShadowCommand` gave a square box spread by 5px corners of radius 5, and a HUD's inset shadow with a negative spread cut a rounded hole in a square face. The rule is exported as `spreadRadius` from `@weasel-js/renderer` and `@weasel-js/core/renderer`.
