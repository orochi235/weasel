---
'@weasel-js/forge': patch
---

A native story file that imports `meta` and `story` from its own module rather than from `@weasel-js/forge`, such as a project helper that re-exports them, is now indexed under its meta's `title`. Before, the index fell back to the path-derived title while the story ran under the meta's, so a link written from the title named no story. The plugin follows the import to where it is declared and checks that it is forge's own; a same-named function of the project's own is still treated as not forge's.
