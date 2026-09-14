---
'@weasel-js/forge': patch
'@weasel-js/ui': patch
---

forge honors Storybook's conditional controls: an argType's `if` naming another arg
— truthy by default, or with `truthy: false`, `exists`, `eq` or `neq` — shows that
control only while the condition holds, through labkit's `showIf`. A condition on a
global is ignored, since a story's config does not carry the lab's globals.

weasel-ui's CurveEditor story shows its grid divisions control only while Show grid
is on.
