---
'@weasel-js/ui': patch
---

A `MenuBar` schema whose titles declare one access letter twice throws, naming both titles and the letter.

Such schemas used to mount, with the letter opening only the first title; they now throw. Letters compare case-insensitively.

<!-- entry: fix -->
