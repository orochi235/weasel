---
'@weasel-js/path-tools': patch
---

Paths warped together no longer drift apart once one is moved alone. Each keeps its own copy of the shared warp, carried with it; the warp tools now treat paths as sharing a warp only while their copies put the same controls in the same places. A path moved or edited on its own comes back under an id of its own, shows its own controls, and is no longer driven by the others' — and its next edit writes that id to it.
