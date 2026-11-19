---
'@weasel-js/routing': patch
---

A brush size shared through `toolOptionsPrefs` keeps any value a sharing tool allows, and each tool reads it held to its own bounds.

The shared leaf takes the widest `min`, `max`, and `endless` of every tool naming the key, so a prefs store no longer clamps a large brush's size to a small brush's max.

<!-- entry: fix -->
