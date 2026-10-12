---
'@weasel-js/theme': patch
---

Adds API: `win9xTheme`, on a new entry `@weasel-js/theme/themes/win9x`. Windows 95 and 98 as a theme over the built-in one: gray faces in two-pixel bevels, square corners, a navy-to-blue title strip, and the system sans at 11, 12, or 14px by density, with control heights to match. It resolves at every mode and density the built-in theme does and opens in light mode.

Decided on an agent's judgment: the dark mode is invented, since the system never had one; the system faces are named in the font stacks and not bundled, so most machines draw Tahoma; and transitions are set to 0ms. `Button`, the field frame, `PropertyPanel`, and the `titlebar` frame motif draw the bevels; other controls take the colors, corners, and type and no bevel yet.

Its text is held to WCAG 4.5:1 on every surface in both modes, emphasis steps and the accent, status, and code colors included, and its control edge to 3:1.
