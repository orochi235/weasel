---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

A CSS-module class name in `@weasel-js/core` and `@weasel-js/ui` now depends on its stylesheet's path alone: `_editor_b9a2b2`, where it was `_editor_s6qnh_7`. The old name hashed the file's contents, so one edited rule renamed every class in the file, and a labkit stylesheet built before the edit styled none of that component.
