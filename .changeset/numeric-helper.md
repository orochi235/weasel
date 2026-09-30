---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Numeric text now has one definition: `.numeric` in the new `@weasel-js/theme/numeric.module.css` export, which sets `--wzl-font-numeric` and `tabular-nums` together. CSS modules take it with `composes: numeric from '@weasel-js/theme/numeric.module.css'`, Less with `.numeric();`, and markup by putting its class on the element. `npm run check:numeric` fails on `tabular-nums` or a read of `--wzl-font-numeric` anywhere else, and on a `font`, `font-family` or `font-variant-numeric` declaration beside the helper, which would replace it.

What that changes on screen:

- `NumberField` and `UnitField` set their value in equal-width digits, so every number input does; it was in the UI face with proportional ones.
- Property rows' slider readouts and their editable inputs, `OpacityRange`'s percentage, `Timeline` ruler ticks, `BandEditor` tick labels, `Slider` readouts, `FallthroughDiagram`'s number columns, `StatusBar`, and labkit's status bar, scale indicator, FPS meter and specimen pane width move to the numeric face. Several were in the mono face, which had been standing in for tabular figures. Code and hex values stay mono.
- `TokenPanel`'s number fields render in the numeric face. They had been forced to mono, which also kept the numeric rules beneath them from ever applying.
- `DataGrid` columns take `numeric: true`, which sets the header and cells in the numeric face and ends them.
- `DetailRow` reads its list's `values` itself, so a figures row's value gets its class directly rather than through a descendant selector.
- forge's font switcher sets `--wzl-font-numeric` to the chosen UI face when that face is not Oswald, instead of leaving Oswald's digits among another face's letters.
