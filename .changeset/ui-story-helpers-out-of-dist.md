---
'@weasel-js/ui': patch
'@weasel-js/devtools': patch
'@weasel-js/hud': patch
'@weasel-js/prefs-editor': patch
---

The published packages no longer ship declarations for the helpers their stories use, such as ui's keycap story fonts.

A module only stories import is named `*.story.ts` or `*.story.tsx`, and the declaration build leaves it out with the stories.

<!-- entry: fix -->
