---
'@weasel-js/d3': patch
---

Exiting nodes can animate out. `d3Bind(...).exit((exit) => exit.transition().pose(fn).remove().end())` keeps the nodes a join would have removed and hands them to your callback as a selection; the new `transition.remove()` deletes each node, as an undoable scene removal, when its transition ends. An interrupted node is not removed, and a key that comes back in a later join while its node is still exiting stops that exit and rebinds the node as an update. Without `.exit()`, a join removes exiting nodes at once, as before.
