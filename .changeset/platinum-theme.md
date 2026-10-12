---
'@weasel-js/theme': patch
---

Adds API: `platinumTheme` and `classicMacTheme`, on a new entry `@weasel-js/theme/themes/platinum`. `platinumTheme` is Mac OS 8 and 9's Platinum appearance as a theme: light gray faces with a black outline and a soft two-tone edge, rounded buttons, white fields, and pinstriped window titles centered on a patch of the face, at 12, 13, or 15px type by density. It resolves at every mode and density the built-in theme does and opens in light mode.

Which era a classic Mac OS theme follows was left open, and Platinum was chosen on an agent's judgment over System 7's one-bit look. It is built so the other can sit beside it: `classicMacTheme` holds what every era shares (the system faces and their sizes, square windows and fields, centered titles, flat control faces) and names no color, and `platinumTheme` extends it with colors and edges alone. A System 7 theme extends the same base.

Also decided on an agent's judgment: the dark mode is invented, since the system never had one, and the system faces are named in the font stacks and not bundled. `Button`, the field frame, `PropertyPanel`, and the `titlebar` frame motif draw the edges; other controls take the colors, corners, and type and no edge yet. Its text is held to WCAG 4.5:1 on every surface in both modes, and its control edge to 3:1.
