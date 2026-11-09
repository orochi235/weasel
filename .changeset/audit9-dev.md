---
'@weasel-js/devtools': patch
'@weasel-js/icons-plugin': patch
---

Fixes from bug-audit round nine in the devtools panel and the icons build plugin.

- `weaselIcons` now follows an `icons.gen` import written through a path alias or any other specifier the bundler resolves. Before, such an `icon()` call was never rewritten, so an app build collected none of its names and trimmed their glyphs.
- `weaselIcons` warns when a module imports `icon` from an `icons.gen` it cannot read a namespace from, instead of silently leaving its calls unrewritten.
- `weaselIcons` reads custom variants by their own keys: an icon namespace named `constructor` is no longer refused as a clash, and `virtual:weasel-icons/toString` fails rather than serving every table.
- A `DevtoolsClient` that closes now reports no roots and no kit version, rather than the last ones its closed connection saw.
- The Scene tab clears the canvas highlight when it unmounts with a row hovered, as when switching tabs from the keyboard.
