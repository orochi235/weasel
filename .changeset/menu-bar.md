---
'@weasel-js/ui': patch
---

New `MenuBar`: a bar of menu groups drawn as titles across the top of an app. Press a title to open its menu, press it again to close it, move onto another title to switch, or press and drag to a row and release to run it. Left and Right walk the titles, Down or Enter opens one, Left or Right inside a menu moves to the next menu, and Escape closes the menu to its title and then gives focus back to where it was. A declared access letter is underlined. Anything at the top level that is not a menu group is drawn between the titles as `Bar` draws it. This is additive.
