---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
'@weasel-js/diagram': patch
'@weasel-js/forge': patch
---

Describe tools and stack tool sets in data, and give forge's global options icons, descriptions and disabled states

- `ToolPresentation.description` says what a tool does. `ToolPalette` reads it in a tool's tooltip in place of the label, the shortcut after it, for a lone button and for a stack's face; `ToolButton` takes `description` for the same. `StrokeClickToolSpec`, `DiagramStencil` and `ContainerStencil` carry one into the tools they build.
- A tool set can be a stack: `toolSet(id, members, { stack: true })`. `ToolPalette` gives each stacked set inside its `include` one button, and its `stacks` takes sets beside id lists; given, `stacks` replaces the stacks `include` would give. `toolStacksOf(entries)` lists them. `withoutTools` keeps a set's `stack`. `WARP_TOOLS` is now a stack, so a palette including it shows the three warps on one button.
- `Select` options and `SelectItem` take `description`, a line under the label in the list, and `disabledReason`, read in its place while the option is disabled. Both become the row's accessible description.
- forge's `GlobalDeclaration` options are `GlobalOption`s, which add `icon`, `disabled`, `disabledReason` and `description`; the globals toolbar draws all four. A lab value naming a disabled option falls back to the nearest enabled one, as one `shows` hides does.
