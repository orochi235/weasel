---
'@weasel-js/core': patch
---

A `follow: 'shape'` selection outline now traces a node whose children are all unpickable, such as a diagram body whose rows are child text nodes, instead of falling back to its box. A node holding a child that can be picked on its own, a member, still keeps its box, and so does a group.
