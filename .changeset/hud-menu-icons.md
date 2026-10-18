---
'@weasel-js/hud': patch
---

The WebGL context menu draws each row's icon in the icon column, at 16px and in the row's color, as the DOM row does; a checked row draws its check there instead. `attachMenuHost` and `createMenuWidget` take `icons`, an icon registry or anything with its `get` and `getVersion`, and a menu without one draws no icons.

`glyphCommands` draws an icon glyph as draw commands, placed in a square and colored wherever it says `currentColor`. It reads the elements the icon tables use, their presentation attributes and transforms, and a nested `svg` as a clip; a `clip-path` pointing into `defs` does not clip.
