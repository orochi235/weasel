---
'@weasel-js/diagram': patch
---

A diagram group may be a member of another group. `DataGroup.members` and a group box's `dependsOn` can name groups as well as nodes; the outer box is drawn around the inner box and behind it, and `layered`, `tree`, and `force` keep a nested group's members together inside its parent's. `GraphGroup.members` is every participant inside a group through any nested group, `GraphGroup.parent` names the group it sits in, and `GraphNode.group` is a node's innermost group. A group id in `members` was ignored before.
