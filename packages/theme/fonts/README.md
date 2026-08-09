# Bundled fonts

Two OFL-1.1 faces, vendored so the kit never fetches a stylesheet from a
third-party host at runtime.

| file | token | role |
|---|---|---|
| `oswald-latin-variable.woff2` | `--wzl-font-ui`, `--wzl-font-display` | condensed UI/display face, variable `wght 200–700` |
| `inter-latin.woff2` | `--wzl-font-body` | body/prose face, weight 400 |

Loading them is opt-in: `import '@weasel-js/theme/fonts.css'`. Skip it and the
token font stacks fall back to `system-ui`.

## Tooling

Both commands need `fontTools` **with the Brotli extension** — without it,
`--flavor=woff2` fails with `ImportError: No module named brotli`. Homebrew's
`fonttools` formula does not include it, so use a throwaway venv:

```sh
python3 -m venv /tmp/fontvenv
/tmp/fontvenv/bin/pip install fonttools brotli
```

## Provenance — Oswald

Upstream `fonts/variable/Oswald[wght].ttf` from
https://github.com/googlefonts/OswaldFont, subset to the Google Fonts `latin`
range plus the three combining marks labkit's `@font-face` declares
(`U+0304`, `U+0308`, `U+0329`):

```sh
/tmp/fontvenv/bin/pyftsubset "Oswald[wght].ttf" \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=oswald-latin-variable.woff2
```

172 kB → 26 kB. The `wght` axis survives subsetting at its full 200–700 range,
which is what `fonts.css` declares. Oswald has no weights outside that range;
anything asking for 100 or 900 is clamped.

`--no-hinting` matches the treatment of `assets/fonts/inter/inter.ttf`; nothing
in the kit reads hints.

Oswald's OFL notice carries **no Reserved Font Name**, so a subset may keep the
family name.

## Provenance — Inter

Re-flavored from `assets/fonts/inter/inter.ttf`, which is already Inter v4.1
`Inter-Regular.ttf` subset to U+0020–00FF and de-hinted (see that directory's
README for the original command):

```sh
/tmp/fontvenv/bin/pyftsubset assets/fonts/inter/inter.ttf \
  --unicodes="U+0020-00FF" \
  --layout-features="kern" \
  --no-hinting \
  --flavor=woff2 \
  --output-file=inter-latin.woff2
```

## License

Both faces are SIL Open Font License 1.1 — `OFL-Oswald.txt` and `OFL-Inter.txt`,
redistributed with the fonts as the license requires. The OFL covers these font
binaries only; the package's code is MIT (see `../LICENSE`).
