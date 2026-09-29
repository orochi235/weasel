# Inter

Two representations of one typeface, for the kit's two text tiers.

| file | tier | what it is |
|---|---|---|
| `inter.json` + `inter.png` | baked MSDF atlas | `registerFont('sans-serif', …)`; serves text below the outline threshold |
| `inter.ttf` | outlines | `registerFontOutlines('sans-serif', …)`; serves text above it, and is the face DOM text such as the edit overlay is set in |

Both cover exactly the same charset — **U+0020–U+00FF** — so the tier a glyph
lands on can never be the reason it fails to render. `inter.json`'s
`info.charset` is the authority on that list.

They also agree on metrics, which is what lets the threshold be a rendering
decision rather than a layout one: the TTF reports `hhea.ascender / unitsPerEm
= 1984 / 2048 = 0.96875`, and the atlas records `common.base / info.size =
31 / 32`, the same number. Advances and kerning in the atlas are the TTF's own
at full precision, so a line laid out from the atlas ends where a browser
setting `inter.ttf` ends it.

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
the threshold the atlas takes over.

The atlas is baked from that subset:

```sh
npm run gen:font -- assets/fonts/inter/inter.ttf --name inter --out assets/fonts/inter --size 32
```

`packages/hud/src/fonts/` carries a byte-identical copy; rebake both together.

## License

SIL Open Font License 1.1 — see `LICENSE.txt`, redistributed with the font as
the license requires.
