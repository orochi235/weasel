---
'@weasel-js/ui-logic': patch
'@weasel-js/guides': patch
'@weasel-js/menu': patch
'@weasel-js/hud': patch
---

Fix three gaps in guides, menus and the HUD menu.

- Moving a placed guide off the rulers now snaps to the edges and centers of the top-level nodes, as placing a new one does. `alignmentSnapSource` took the guide's id as a node whose siblings to measure, and found none.
- A menu access letter, or a typeahead key, outside the Basic Multilingual Plane (an emoji) is now read as one character.
- A HUD menu's color picker checks the swatch the color holds at its current alpha, so the swatch just chosen shows checked after the alpha has changed.

A list's typeahead counts a typed key by code point, as menus now do, so an emoji types and a repeated one cycles; `isOneChar` from `@weasel-js/ui-logic` is the one rule both use.
