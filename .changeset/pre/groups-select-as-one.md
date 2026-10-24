---
'@weasel-js/core': patch
'@weasel-js/modes': patch
'@weasel-js/routing': patch
'@weasel-js/symmetry': patch
'@weasel-js/theme': patch
---

A group now selects as one item:

- A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
- A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. Both work under any tool. While a group is entered only what is inside it can be pressed, marqueed, lassoed or selected with Select All. Under the select tool a press outside the entered group's box, with or without modifiers, leaves every group that box is outside of and selects nothing; that leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. Under a drawing tool the press draws, and what is drawn or pasted lands in the entered group: core now sources the `insertInto` dep from it, under any source registered after it, and `sceneToAdapter`'s new `pasteInto` option says where a paste lands. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
- Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
- The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes an `EnteredGroupApi` made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own. `leaveAll()` leaves every level at once.
- `createEnteredGroupScope({ entered, scene })` returns a `NodeScope` (from `@weasel-js/modes`, which `ScopingDim` now extends) for the entered group, everything outside it dimmed to `OUT_OF_SCOPE_ALPHA`. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
- The entered-group frame takes its color from the `--wzl-entered-group` override hook on the canvas or any element above it, and repaints when a theme, mode or class attribute changes there or the system color scheme flips.
- A contribution's dep source may read the source it displaces: `ContributionDeps` entries take the `below` argument `DepSource` does. The symmetry contribution's `insertInto` falls through to it when no symmetry group is active.
- `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.

Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
