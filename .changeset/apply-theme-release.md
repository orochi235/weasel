---
'@weasel-js/theme': patch
---

`applyTheme` returns a release, and a theme's rule lives as long as something holds it. The rule goes into the stylesheet of the document or shadow root the element is in, so a popout window fed by a portal and a shadow tree get their theme; it went into the global `document` only. A rule leaves the sheet when the last element holding it is released or given another theme, so a page that mints a theme name per instance no longer grows its stylesheet without bound; `<ThemeProvider>` releases on unmount. Two different themes sharing a name no longer overwrite each other: the second held at once is kept to its own elements by a `data-wzl-variant` attribute, matched inside `:where()` so specificity is unchanged.

The release also takes the `data-wzl-*` attributes back off its element. Code that called `applyTheme` and ignored the result keeps working; applying to one element again replaces what it held.
