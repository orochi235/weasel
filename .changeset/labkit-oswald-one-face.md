---
'@weasel-js/labkit': patch
'@weasel-js/theme': patch
---

labkit's stylesheet no longer declares its own Oswald face. It takes the
theme's Oswald and Inter faces from the new `@weasel-js/theme/faces.css`, which
holds the `@font-face` rules without the `:root` font that `fonts.css` also
sets. Built from source, labkit's styles now load Oswald from the theme's
`fonts/` directory instead of requesting a `./fonts/` path that 404'd and
dropped text to the system's weights. The published `dist/styles.css` still
carries both faces, pointed at its own `dist/fonts/` copies.
