---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Every `--wzl-*` custom property the components read is now one a theme declares,
or a documented override hook. A read of a name nothing declared resolved to
nothing, which silently dropped the whole declaration it sat in.

What changes on screen, in labkit's lab switcher: its menu items take the body
font size instead of inheriting the title's, the trigger turns the accent color
on hover, and the menu's shadow, like the floating workspace panel's, now takes
its color from `--wzl-shadow` so it follows the theme and mode. The menu stacks
at `--wzl-z-overlay`. In `@weasel-js/ui`, the disclosure chevron eases with
`--wzl-ease-out-cubic` and a property card's remove button reads `--wzl-danger`
directly; both render as before.
