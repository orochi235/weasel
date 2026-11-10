---
"@weasel-js/core": patch
---

Group and the boolean group now put a group whose members have different parents in the members' lowest common ancestor, in the place of the frontmost member's branch. Before, it went to the page the members overlap most, or to the top of the tree, and left every container they shared.
