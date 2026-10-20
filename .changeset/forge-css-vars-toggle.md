---
'@weasel-js/forge': patch
---

forge's CSS Vars panel is hidden by default, behind a new toggle in the lab header beside Info. The lab remembers
whether it was left on. `cssVars: false` still leaves out the panel, and now the toggle with it.
