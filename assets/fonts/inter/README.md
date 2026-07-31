# Inter

Two representations of one typeface, for the kit's two text tiers.

| file | tier | what it is |
|---|---|---|
| `inter.json` + `inter.png` | baked MSDF atlas | `registerFont('sans-serif', …)`; serves text below the outline threshold |
| `inter.ttf` | outlines | `registerFontOutlines('sans-serif', …)`; serves text above it |

Both cover exactly the same charset — **U+0020–U+00FF** — so the tier a glyph
lands on can never be the reason it fails to render. `inter.json`'s
`info.charset` is the authority on that list.

They also agree on metrics, which is what lets the threshold be a rendering
decision rather than a layout one: the TTF reports `hhea.ascender / unitsPerEm
= 1984 / 2048 = 0.96875`, and the atlas records `common.base / info.size =
31 / 32`, the same number.

## Provenance

Inter v4.1, `extras/ttf/Inter-Regular.ttf` from the upstream release, subset
to the atlas charset:

```sh
pyftsubset Inter-Regular.ttf \
  --unicodes="U+0020-00FF" \
  --layout-features="kern" \
  --no-hinting \
  --desubroutinize \
  --output-file=inter.ttf
```

411 kB → 27 kB. `--no-hinting` because nothing reads the hints: the outline
tier only ever draws this face large, where hinting does not apply, and below
the threshold the atlas takes over. The atlas was baked from Inter separately
(see `packages/font/scripts/gen-font.ts`); glyph outlines are stable across
Inter 3.x/4.x for this charset, and in any case the two tiers never draw the
same glyph at the same time.

## License

SIL Open Font License 1.1 — see `LICENSE.txt`, redistributed with the font as
the license requires.
