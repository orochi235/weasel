---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Surfaces can say what kind of content they hold and which of their peers they are. `PropertyPanel`, `PropertyGroup`, `Subpanel`, `Callout`, `Dialog`, labkit's `ControlPanel` and its sidebar sections take `stance` (`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`, `preview`) and `tone` (an index into the theme's tone list, or a color). The theme draws each stance from `--wzl-panel-*` and `--wzl-stance-*` slots, and a surface given a tone recolors the controls inside it. `ControlPanel` wraps its rows in a titled `PropertyPanel` when given any of `title`, `stance` or `tone`.

`@weasel-js/theme` adds `ColorList` — literals, the categorical generator, a theme ramp, or a function — read with `colorAt`, `colorCssAt` and `colorCount`; `tones` on theme definitions; `<ThemeProvider tones>` and `useTones()`; and `STANCES` / `STANCE_SLOTS`. labkit's `nebula` takes a `ColorList`.

Breaking: `EffectCard`'s `accent` is now `tone`, and `--wzl-effect-card-accent` is gone. `Callout`'s `tone` (`info` / `warning` / `danger`) is now `stance` (`notice`, the default / `important` / `danger`), and `CalloutTone` is removed. A subpanel's rule now reads `--wzl-line-subtle` rather than a fixed translucent white, so it shows in light mode.
