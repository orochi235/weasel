---
'@weasel-js/core': patch
---

A fix to loading a saved scene.

- `specsFromSerialized`, and so `nodeSpecsFromSnapshot` and every loader built on it, resolves the kit's own registry keys (`core:pageRun`, `core:pageClip`, `kit:unionOfChildren`, `kit:booleanOfChildren`, `kit:clipNothing`) under the registry it is handed, as `createScene` and `sceneFromJSON` already did. Before, a snapshot loaded through it with a consumer registry lost its page run's layout and each page's clip: WeaselDraw dropped both on every reload and on its starter document, with a console warning.
