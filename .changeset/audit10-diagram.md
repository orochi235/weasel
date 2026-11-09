---
'@weasel-js/diagram-elk': patch
---

Fixes to how the ELK adapter lays out self-loops and empty groups.

- `elkPlan` leaves an edge from a node to itself that names at most one port to the diagram's own self-loop rule, which loops it round a corner. Before, it handed back ELK's route with the same port named at both ends, and the loop was drawn as a notch on one side.
- A group holding no members widens to its `minWidth` when ranks run up or down. Before, ELK read its minimum with the axes swapped, as it does only for a group that holds something, and the group grew tall instead.
