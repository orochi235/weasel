---
'@weasel-js/ui': minor
'@weasel-js/ui-logic': minor
'@weasel-js/labkit': minor
---

New `<Density size>` sets the size of every `sm`/`md` control inside it, and `useDensity` reads it.

The nearest scope wins, and a control's own `size` wins over any scope. With no scope, each control keeps its default: `md`, or `sm` for `ThemeSwitcher`. `Button`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `ColorModeControl`, and `ThemeSwitcher` read it. ui-logic's `resolveSize(own, scope, fallback)` is the same rule without React, for a host such as hud.

```tsx
<Density size="sm">
  <Button>Apply</Button>              {/* sm */}
  <Button size="md">Cancel</Button>   {/* md: its own size wins */}
</Density>
```

labkit re-exports `Density`, `useDensity`, `ControlSize`, `DensityProps`, and `DensityScopeProps`.

<!-- entry: rank=5 new api -->
