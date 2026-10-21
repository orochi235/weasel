---
"@weasel-js/routing": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/path-tools": patch
---

An action can carry a settings form: `Action.settings` holds a prefs schema, a `read` that gives
the selection's current values (and which fields it disagrees on), and an optional `params` that
turns one field's change into the params the action is triggered with. Every surface that lists
actions draws such an action as its form instead of a button that triggers it bare: a bar or a
panel opens it in a popover under the action's button, a menu shows it as a submenu of its fields,
and the command palette opens it in a dialog. Each change is one trigger, so one undo step. The
form is disabled while the action's `enabled` says no. `readActionSettings` and
`actionSettingsParams` are what the surfaces read it through; `useActionSettings`,
`ActionSettingsPopover` and `ActionSettingsDialog` are in `@weasel-js/ui/components/ActionSettings`.
`BarActionButton` takes `expanded` for a button that opens a dialog.

Warp Settings (`configureWarp`) and Edit Path Effect (`editPathEffect`) carry one each, so Warp
Settings on a bar now opens Mode, Rows, Columns, Mapping and Tolerance for the selected warps
rather than doing nothing, and both are disabled with nothing they apply to selected.
`editPathEffect` takes an optional `kind`, limiting an edit to effects of that kind, and now reads
`selection`. The forms are exported as `warpSettingsForm` and `pathEffectSettingsForm`.
