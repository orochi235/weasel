---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Adds API: override hooks a theme can pin to draw its edges in relief, where the token set had no way to say it. `--wzl-bevel-raised` is the box shadow of a raised face (a primary or secondary `Button`, a `PropertyPanel`), `--wzl-bevel-pressed` that of a button held or kept down, and `--wzl-bevel-sunken` that of a field's frame, whose border and focus shadow take `--wzl-field-border` and `--wzl-field-focus-shadow`. A `Button`'s glass gives way to a flat face through `--wzl-button-surface`, `--wzl-button-pressed-surface`, `--wzl-button-primary-surface`, `--wzl-button-primary-pressed-surface`, `--wzl-button-primary-fg`, `--wzl-button-primary-bevel`, `--wzl-button-radius`, `--wzl-button-gloss`, and `--wzl-button-text-shadow`.

Each is read with the look it replaces as its fallback, so nothing changes until one is set, and each is listed in `TOKEN_MANIFEST` with `hook: true`. A theme built with `defineTheme` pins them like any token; a container below it still overrides the pin. Which controls read a bevel was decided on an agent's judgment: the button, the field frame, and the panel, and no other control yet.
