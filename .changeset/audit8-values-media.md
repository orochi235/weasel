---
'@weasel-js/quantity': patch
'@weasel-js/paint': patch
'@weasel-js/audio': patch
---

Fix lookups, hue interpolation and bus ramps in quantity, paint and audio.

- A unit, display kind or spoken unit named for an `Object.prototype` member (`toString`, `constructor`) reads as unknown: `unitScale` throws, the display falls back to `decimal`, and the unit is spoken by its name, instead of picking up the inherited function.
- `snapToStep` and spin keys keep every decimal of a step written in e-notation: a step of `1.5e-7` now snaps to multiples of it rather than of `1e-7`.
- `lerpHueDeg` keeps the sign of a half turn, as CSS's hue fixup and `lerpOklch` do: 180° to 0° under `shorter` now passes 90°, not 270°. This changes theme ramps between exactly opposite hues.
- `parseColor('constructor')` and the other `Object.prototype` names throw as unrecognized colors, and `cssColorNotation` answers `null` for such a space instead of throwing a `TypeError`.
- `paintKey` folds a solid's `opacity` into its color's alpha, so `rgba(255, 0, 0, 0.5)` and `#f00` at opacity 0.5 share a key, as they draw the same.
- Changing one bus's gain, mute or solo no longer cuts another bus's gain ramp short: only faders whose value changed are written.
