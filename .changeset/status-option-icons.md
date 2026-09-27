---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Status glyphs and icon options in segmented controls. `@weasel-js/ui` adds `statusAccent`, `statusNeutral`, `statusMuted` and `statusSuccess` to the icon set, and `BADGE_STATUS_ICONS` maps every `BadgeStatus` but `custom` to a glyph (info, warn and danger reuse `info`, `warning` and `error`). A `PropertyField` enum segment that draws a glyph now shows its label as a tooltip. labkit's `ConfigOption` takes an `icon`, and a forge argType takes `control: { type, icons: { option: iconName } }` to put one on each option.
