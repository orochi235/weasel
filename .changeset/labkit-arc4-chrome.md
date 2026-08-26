---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Draw labkit's chrome and the ui components from one type, weight and shape
scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
converge as part of that fold — the two still differ in height and padding.

Three components that were exported but rendered nowhere now appear in the
default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
`ZoomControl` in the viewport controls, replacing the plain zoom readout.
`StatusBar.Section` takes `end` to push a readout to the far side, mirroring
`Toolbar.Group`.

The trial's box-shadow no longer derives from the foreground color, so
elevation reads as elevation rather than as a halo on dark themes, and its
border clears 3:1 against the workspace in both modes.

`<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
one button in the tab order, arrows moving focus within, Home and End jumping
to the ends. It takes an `aria-label`.

Two colors were wrong rather than merely untokenized. The selected toggle in
`PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
and rendered in the OS blue.
