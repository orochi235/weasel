---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Draw the lab's color mode as icons instead of words.

`@weasel-js/ui` gains three glyphs — `modeLight` (a rayed sun), `modeDark` (a
crescent) and `modeAuto` (a four-pointed sparkle) — with `ModeLightIcon`,
`ModeDarkIcon` and `ModeAutoIcon` beside the other named components.

labkit's header bar becomes `size="sm" variant="flat"`, the same treatment the
stroke cap / join / align rows use, with each segment holding a 14px glyph.
The words move to `ariaLabel`, so the control is still a radiogroup announcing
Auto / Light / Dark and its keyboard behaviour is unchanged.
