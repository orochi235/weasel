---
'@weasel-js/forge': patch
---

The API table and args panel read a meta's `component` through forge's own `meta()` only, as the dependency graph does, so a meta built by a project helper documents the same component in both.

<!-- entry: fix -->
