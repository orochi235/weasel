---
"@weasel-js/renderer": patch
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

A shadow's spread rounds corners as CSS `box-shadow` does, so a square box casts a square shadow.

This holds for `dropShadowLayers`, `dropShadowCommand` and a HUD's inset shadow. The rule is exported as `spreadRadius` from `@weasel-js/renderer` and `@weasel-js/core/renderer`.

<!-- entry: fix visual api -->
