---
'@weasel-js/core': patch
---

A `LayerGroup` member name now claims that layer and every layer under it in the `:` namespace, so `layers: ['scene']` covers the `scene:<layerId>` layers a scene with declared layers draws as — the same set `before`/`after: 'scene'` anchors against. The separator is required, so `'scene'` does not reach `scenery`. A member matching no layer being drawn is warned about rather than silently ignored; one group naming a layer both directly and through its namespace is treated as redundant, not as a conflict.

Additive for a group whose members all name layers exactly. A group that named a namespace prefix and relied on it grouping nothing now groups those layers, and a member that matched nothing now logs a warning where it previously stayed quiet.
