---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `showIf` or an `enableIf` on a node of a surface's own schema may read a setting of `over`, the schema the surface is drawn over. A path no leaf of the surface's own schema holds is looked up in `over`, in `PrefsForm`, `PrefsDialog`, `Bar`, `ToolOptionsBar`, `SelectionPanel`, and labkit's `ControlPanel`: the condition compares the value as that leaf's control shows it, through its `encoding`, where before it compared the stored value. A path both schemas hold reads the surface's own leaf.

Where the surface holds no value at such a path, it reads `over`'s leaf as it reads a leaf of its own. A `PrefsForm` and a `ControlPanel` take the leaf's default, where before the path read as unset. A `SelectionPanel` takes the default only of a leaf that is `absentIsDefault`, and a `Bar` reads `values` alone.

Adds API in `@weasel-js/prefs`: `prefJudge`, `prefReader`, `prefShownReader`, `checkPrefCondition`, and `checkPrefConditions` each take `over` as a last argument, and `prefSchemaHolding(schema, path, over)` says which of the two answers for a path. With `over`, the checks report `no-leaf` only for a path neither schema holds, and hold a comparison to whichever leaf answers.

`PrefConditionEditor` takes `over`: its pickers list that schema's prefs after the condition's own, each named for the schema it is in (`Settings: view.grid`), and a row that reads one is checked against it. `PrefSchemaEditor` hands a layout's conditions the dialog the layout is drawn over, so its `bad condition` badge and its condition rows know that dialog's settings. `conditionLeaves` takes `over` as a third argument and marks each such leaf `over: true`.

labkit: `resolveConfigSchema` takes `over` as a third argument. Without it a schema whose condition reads a setting of another schema is refused, as any condition that reads no leaf is. `conditionedLeaf` takes `over` as a last argument, and `selectionJudge` in `@weasel-js/ui` as a fourth.
