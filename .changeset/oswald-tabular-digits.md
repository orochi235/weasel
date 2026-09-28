---
'@weasel-js/theme': patch
---

Add `--wzl-font-numeric` and the `Oswald Tabular` face behind it. Oswald has no tabular figures, so `font-variant-numeric: tabular-nums` aligned nothing in the UI face. `Oswald Tabular` is Oswald's ten digits alone, each centered in the widest digit's width at every weight from 200 to 700; the token puts it in front of `--wzl-font-ui`, so an element set in `--wzl-font-numeric` gets equal-width digits and every other character from the UI face unchanged. `faces.css` declares the new face, and labkit's `dist/fonts` picks up the file.
