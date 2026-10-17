---
'@weasel-js/ui': patch
---

New `MenuBar`: a bar of menu groups drawn as titles across the top of an app. Press a title to open its menu, press it again to close it, move onto another title to switch, or press and drag to a row and release to run it. Left and Right walk the titles, Down or Enter opens one, Left or Right inside a menu moves to the next menu, and Escape closes the menu to its title and then gives focus back to where it was. F10 focuses the bar from anywhere in the app, and a title's underlined access letter, pressed with the bar's `accessChord` held (Alt by default; matched by physical key, so macOS Option works), opens its menu. These keys go through the gesture dispatcher ahead of the app's own bindings, a focused text input keeps them, and a disabled title's letter is left to the app. A title follows its group's `showIf` and `enableIf`. Anything at the top level that is not a menu group is drawn after the menubar as `Bar` draws it. This is additive.
