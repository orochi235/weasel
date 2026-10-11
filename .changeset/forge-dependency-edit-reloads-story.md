---
'@weasel-js/forge': patch
---

`forge` (the vite plugin): editing a module a story file imports, such as a fixture or a helper, now reloads the open story in the workshop. The workshop kept showing the code from before the edit until the page was reloaded, because only an edit to the story file itself named the story to load again.
