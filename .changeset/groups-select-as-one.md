---
'@weasel-js/core': patch
'@weasel-js/modes': patch
---

A group now selects as one item:

- A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
- A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. A press outside the entered group's box leaves every group that box is outside of, and selects nothing: nodes outside the entered group take no hits. That leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
- Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
- The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes one made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own.
- `createEnteredGroupScope({ entered, scene })` answers `alphaFor` and `isPointerInteractive` for the entered group, everything outside it dimmed to 0.3. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
- The entered-group frame takes its color from the `--wzl-entered-group` custom property on the canvas or any element above it.
- `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.

Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
