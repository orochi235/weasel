---
'@weasel-js/core': patch
---

A scene slot's `toPose` is handed each node as the scene shows it: its `pose` is a pose override's or a derived one, where it used to be the stored pose. A view drawn through a `toPose` now shows a drag in flight, a rig's bound nodes, and a skinned path, whose override `path` is carried from the box the scene shows the node at into the box `toPose` answers. A dependency read through such a slot answers the carried path too, and so does one in a scene that composes frames. Breaking for a `toPose` that relied on seeing the document's pose mid-gesture; one that places a node from its data alone, ignoring `node.pose`, still shows no motion.
