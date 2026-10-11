---
'@weasel-js/forge': patch
---

The index of a native story file follows what the file imports. An import or a re-export is listed only when its declaration is a story, an export that calls an imported function is listed when that function returns one, and a conditional or a spread copy is read by what it picks or copies from. A constant re-exported from another module is no longer a story that faults when opened, and a story built by a factory in another module is no longer missing from the tree.
