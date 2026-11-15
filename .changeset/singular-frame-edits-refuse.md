---
'@weasel-js/core': major
'@weasel-js/diagram': major
'@weasel-js/symmetry': major
---

Group, ungroup, a reparenting drop, a clone or paste landing, and a follower move refuse whole rather than put a node in a singular frame.

They promise every node stays where it is shown, and no pose stored in a frame scaled to nothing keeps that promise. Each leaves the scene and its history as they were, and `group` and `ungroup` report `NotApplicable`. A container whose frame is singular takes no children by drop, insert or paste, and an insert asked into one lands at the top of the tree. In diagram, releasing members into one does nothing; in symmetry, a center change for a group in one is ignored.

<!-- entry: behavior -->
