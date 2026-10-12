---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit's stylesheets, core's debug HUDs, and forge's shell and story frame take every `gap`, `padding`, and `margin` that has a rung from the `--wzl-space-*` ladder, where each held the same px as a literal. Core, which draws on a page that may load no theme, keeps that px as the `var()` fallback, so nothing moves there.
