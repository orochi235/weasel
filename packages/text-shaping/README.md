# @weasel-js/text-shaping

OpenType shaping through [HarfBuzz](https://harfbuzz.github.io/): font bytes and text in,
positioned glyphs out. It is what lays out the scripts whose letters change with their
neighbors: Arabic joining, Indic conjuncts and vowel signs drawn before their consonant,
Thai and Khmer mark stacking, ligatures, and a face's own small capitals.

Nothing else in weasel depends on this package. A text layout handed a shaper uses it, and
one that isn't finds each character's glyph on its own and kerns pairs, which is right for
Latin, Greek, Cyrillic and CJK. Importing it costs nothing: HarfBuzz's WebAssembly (about
450 kB) loads when `loadShaper` is called.

## Giving it to weasel's text

```ts
import { loadShaper } from '@weasel-js/text-shaping';
import { bidi } from '@weasel-js/bidi';
import { registerBidi, registerShaper } from '@weasel-js/core';

registerBidi(bidi);
registerShaper(await loadShaper());   // once, at startup, before text is laid out
```

Shaping reaches text set in a face registered with `registerFontOutlines` from TrueType or
OpenType bytes: its glyphs are drawn from the outlines by index, so any glyph a shaping
produces can be drawn. Text served by a baked or canvas atlas looks glyphs up by character
and is laid out as before; so is a face loaded from WOFF, whose bytes HarfBuzz cannot read.
Right-to-left text also needs the bidi engine, which puts its letters in visual order.

With a shaper registered, `fontVariantCaps: 'small-caps'` on a face that has an `smcp`
feature draws the face's small capitals rather than shrunken capitals, and `lang` (a BCP 47
tag, `'sr'`, `'ur'`) on a run or a node's style selects the face's forms for that language.

## Using it alone

```ts
const shaper = await loadShaper();
for (const g of shaper.shape(fontBytes, 'بيت')) {
  // g.gid, g.advance, g.dx, g.dy in ems; g.cluster indexes the text
  const d = shaper.glyphD(fontBytes, g.gid, g.dx, g.dy);
}
```

`shape` cuts the text where its Unicode script changes, keeping spaces, digits, punctuation
and marks with the letters around them and a closing bracket with its opening one, and
shapes each piece in its letters' direction, then returns the glyphs in logical order. Its optional fourth argument is a BCP 47
language tag. `glyphD` is em-space SVG path data, y
down. Pass the same `ArrayBuffer` for the same face every time: the parsed face is held
against it.

## Bundling

harfbuzzjs finds its `.wasm` beside its own module with `new URL('harfbuzz.wasm',
import.meta.url)`. Vite needs no configuration for it: a production build emits the file
as an asset and points the URL at it, and the dev server's dependency pre-bundle points the
URL back at the file in `node_modules`.

harfbuzzjs awaits at its module's top level, so the bundle must target ES2022 or later.
Loading it through `loadShaper`'s dynamic `import()` does not hide that from a bundler:
esbuild (and Vite 7 and earlier, which pre-bundle with it) refuses a lower target, while
Vite 8 warns and leaves the `await` in place.
