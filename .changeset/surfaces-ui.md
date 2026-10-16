---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

An `actions` leaf now draws one button per action registered in its group, in registry order and a variant each, the way an `action` leaf naming that action would. In a bar the buttons sit in one cell; in a prefs form, a selection panel, or a labkit panel each is a row of its own. An action registered later appears without the schema changing. `BarActions` and `PrefActionRows` draw them, and `actionsLeafActions` turns the leaf into the `action` leaves it stands for.

`ActionBar` is now a `Bar` over one `actions` leaf for its `group`. `tag`, `only`, `icons`, and `labels` have no schema form, so they filter what that leaf expands to; their behavior is unchanged.

In a panel an action reads its icon and label once, on a full-width button, with no row label beside it. It takes its disabled state from the registry, keeps a disabled button focusable with the action's reason in its tooltip, and says in its tooltip when its key names nothing registered. An action with `control: 'icon'` keeps its labeled row.

A leaf with `readout: true` draws as its value in words, not as a control, in bars and panels alike: an enum's option label, a number in its display with its unit, a flag as On or Off, a color as a swatch beside its hex. Field props carry it as `readOnly`, which `PropertyControl` and `PropertyField` draw through the new `PropertyReadout`, an `<output>` the row's label names.

A group drawn `as: 'menu'` in a `Bar`, or in a bar of a prefs form, is now a button that opens the group as the context menu's panels (`BarMenu`), resolved by `resolveSchemaMenu` with the bar's `values`, `onChange`, and `over`: actions as items, flags as checked items, choices as radio rows, nested groups as submenus.

`Bar` takes `framed="segmented"`: a compact strip whose buttons sit almost touching, so a run of actions reads as one control. `ActionBar` draws on it, in place of a stylesheet of its own.
