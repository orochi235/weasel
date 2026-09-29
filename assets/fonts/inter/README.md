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
decision rather than a layout one: both tiers place the baseline from the
ascent and descent in the atlas's `faceMetrics` block, which the outline tier
recomputes from the TTF's tables — `1984 / 2048 = 0.96875` and `494 / 2048`,
where Inter's `hhea` and typo values coincide. Advances and kerning in the
atlas are the TTF's own at full precision, so a line laid out from the atlas
ends where a browser setting `inter.ttf` ends it.
The rest of that block — underline, strikeout, script metrics, x-height and
cap height — is derived from the TTF's `post` and `OS/2` tables by the same
function, so both tiers place rules, scripts and small caps alike too.

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
