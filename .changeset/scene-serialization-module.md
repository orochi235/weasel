---
'@weasel-js/core': patch
---

Internal: The scene's serialization (the toJSON walk, and the readers that turn a snapshot back into layer records and node specs) moves out of scene.ts into serialization.ts. No behavior change.
