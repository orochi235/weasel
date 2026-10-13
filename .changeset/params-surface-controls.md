---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Adds API: `prefFieldProps(leaf, state, surface)` in `@weasel-js/ui` takes the surface a leaf is drawn on (`'form'`, `'panel'`, or `'lab'`) and returns the control that surface draws for what the leaf asked for, writing when that surface writes. `PARAMS_CONTROLS` is the table behind it: what a row draws for a boolean naming no control, whether a boolean's `toggle` is drawn, whether a slider with an end of its range missing is still a slider, and whether an enum's `radio` and `menu` draw as asked. `withSurfaceControl(field, surface)` applies it to a field already made, and `withRowControl(field, surface)` fills in a row's control for a boolean naming none.

`PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` each decided these in their own code and now read the table. Nothing draws differently.
