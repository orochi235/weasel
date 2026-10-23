---
'@weasel-js/core': patch
---

A group now selects as one item:

- A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
- A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape, or a press outside the entered group's box, leaves it one level. A double-click on a member that is not a group still reaches text and path editing. In isolation mode, the isolation double-click drills in as before.
- Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
- The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered.
- `useEnteredGroupDepSource` now takes the store `useEnteredGroup(scene)` returns, so the picking that names a double-click and the actions share one.
