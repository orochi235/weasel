---
'@weasel-js/core': patch
---

A scene snapshot's document values and declared node fields are copies the caller may edit, as its poses are.

That covers `page`, `pageRun`, `units`, `clip`, `dependsOn` and layer `parallax`, and a load copies them out of the snapshot it reads.

In development, a document value or declared field handed to the scene is frozen, as a pose is, so a later write into it throws instead of changing the scene behind history's back.

<!-- entry: fix -->
