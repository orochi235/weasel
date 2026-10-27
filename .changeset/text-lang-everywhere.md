---
'@weasel-js/text': patch
'@weasel-js/text-dom': patch
'@weasel-js/svg': patch
---

A text's `lang` now reaches more than the shaper. `textTransform` and synthesized small caps map case in the run's language, so `i` uppercases to `İ` under `tr`; `transformRunTexts` takes the languages as an optional third argument, `smallCapsText` as a third and `isSmallCapsLetter` as a second, and a tag `Intl` rejects maps as no language. The edit overlay sets the `lang` attribute from the node's style, and each run span from its run, and reads a pasted span's `lang` back as the run's. SVG export writes `xml:lang` on `<text>` and `<tspan>`; import reads `xml:lang` or `lang`, inherited from any ancestor onto the node and a `<tspan>`'s own onto its run. This adds API.
