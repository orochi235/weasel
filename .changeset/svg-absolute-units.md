---
'@weasel-js/svg': patch
---

`parseSvg` converts absolute CSS units (`mm`, `cm`, `in`, `pt`, `pc`, `Q`) at 96 per inch wherever it reads a length: geometry attributes, `stroke-width`, `stroke-dasharray`, `font-size`, `letter-spacing`, and the root `width` / `height`. `<circle r="5mm">` now imports with a radius of 18.9 instead of 5, and `ParseResult.width` for `width="210mm"` is 793.7. Font-relative units (`em`, `ex`) still read as their bare number and warn.
