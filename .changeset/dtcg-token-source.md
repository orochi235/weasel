---
"@weasel-js/theme": minor
"@weasel-js/labkit": patch
---

Design tokens are generated from a DTCG source.

`packages/theme/tokens/` is now the only hand-edited token artifact. One
generator emits `tokens.css`, the TS theme objects, the `TokenName` union, and
the Storybook token manifest, replacing a hand-written stylesheet, a
hand-mirrored `DEFAULT_TOKENS` object, and two separate regex parsers that each
re-derived the token list from CSS on disk. A determinism test fails if the
committed output drifts from the source.

The `color-mix()` tokens (`--wzl-line*`, the button hover/pressed fills) are now
computed exactly on the JS side instead of being, per the old file's own header,
"plausible hex approximations". CSS output still emits `color-mix()` so a
downstream override of the referenced token keeps tinting.

Modes are selected with `data-wzl-mode` (was `data-theme`), and are declared
per-theme in the DTCG source rather than as hand-restated selector blocks.

Oswald and Inter now ship with the package under OFL 1.1 and load via a new
opt-in `@weasel-js/theme/fonts.css` entry; `tokens.css` no longer `@import`s a
stylesheet from `fonts.googleapis.com`. labkit consumes the same font files
instead of its own copy — which it had been publishing with no license file,
no `OFL.txt`, and no attribution — and gains the `LICENSE` it was missing. Its
`@font-face` also no longer declares a `100 900` weight axis; Oswald's real
range is `200 700`.
