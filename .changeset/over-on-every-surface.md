---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`SelectionPanel`, `Bar`, `ToolOptionsBar`, and labkit's `ControlPanel` take `over`, a `PrefGroup` or a `PrefSection`, as `PrefsForm` does: the schema their `alias` leaves point into, when that is not their own. An alias is drawn as the leaf of `over` at its path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Its value is read and written at that path in what the surface already edits: `values` and `onChange` in a `Bar`, `config` and `setConfig` in a `ControlPanel`, and every selected node in a `SelectionPanel`, where a `PrefGroup`'s keys are steps of the node path and a `PrefSection`'s leaf keys are whole node paths. `ToolOptionsBar` hands `over` to its `Bar`, and `PrefSchemaEditor`'s preview of a properties layout hands its panel the schema the layout points into.

Each surface reads `over`'s conditions as it reads its own schema's. A `ControlPanel` reads `config` and `over`'s defaults where `config` holds nothing, since a lab's config holds no value for another schema's leaves. A `Bar` reads `values` alone and a `SelectionPanel` reads the nodes, with a leaf's default only where it is `absentIsDefault`.

Adds API: `prefAliasTargets(over, judge, options)` in `@weasel-js/prefs`, the schema a surface's aliases point into as that schema's conditions leave it. `shown(alias)` gives the leaf an alias is drawn as, under the alias's own name and description where it gives them, with the path its value lives at; `leafAt`, `disabledAt`, `hiddenAt`, and `entryAt` answer for what is inside that leaf. Every surface resolves an alias through it. labkit's `isLeafVisible` and `isLeafEnabled` take `over` as a last argument, and `ControlRow` takes it as a prop.

Breaking: `effectiveSections`'s `shownOf` hands back `{ schema, targets? }`, a `PanelShown`, where it handed back the narrowed schema or null: `targets` is what that kind's aliases are drawn from. `conditionedSections` takes `over` as a sixth argument and hands back `targets` when given it, and `selectionJudge` judges a `PrefGroup` as well as a `PrefSection`.
