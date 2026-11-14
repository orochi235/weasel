---
'@weasel-js/ui': minor
---

Bars, tool rails, tool groups, and the status bar take a `size` that reaches the controls inside them.

The containers are `Bar`, `BarLayout`, `ActionBar`, `ToolOptionsBar`, `ToolGroup`, `ToolRail`, and `StatusBar`.

It sets a `<Density>` scope over what the container holds, so `<ToolOptionsBar size="sm">` draws its buttons and segmented bars at `sm` without a `size` on each. A control that sets its own keeps it. Every container takes the prop through the one `DensityProps` type.

<!-- entry: api new -->
