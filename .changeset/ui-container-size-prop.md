---
'@weasel-js/ui': minor
---

Bars, tool rails, and tool groups take a `size` that reaches the controls inside them.

The containers are `Bar` (so `PrefsBar` and a `framed="status"` strip), `ActionBar`, `ToolOptionsBar`, `ToolGroup`, and `ToolRail`.

It sets a `<Density>` scope over what the container holds, so `<ToolOptionsBar size="sm">` draws its buttons and segmented bars at `sm` without a `size` on each. A control that sets its own keeps it. Every container takes the prop through the one `DensityProps` type.

<!-- entry: api new -->
