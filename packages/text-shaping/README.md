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

Shaping reaches text set in a face whose TrueType or OpenType bytes are registered with
`registerFontOutlines`. That face can also be a baked atlas (`registerFont`) or a canvas face
(`registerCanvasFont`): register the same family and variant with `registerFontOutlines` too,
and its text is shaped from that file. A baked atlas must be cut from the same file, or its
advances disagree with the shaper's. On an atlas face, a letter the shaping leaves as its own
glyph still draws from the atlas; a shaped cluster (a conjunct, a joining form, a placed mark)
draws from its outline, and on a canvas face below the outline size from a tile baked from that
outline. A face loaded from WOFF, whose bytes HarfBuzz cannot read, is laid out as before.
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

The package ships HarfBuzz's WebAssembly as `dist/harfbuzz.wasm` and finds it with
`new URL('harfbuzz.wasm', import.meta.url)` from its own JavaScript. Vite needs no
configuration for it: a production build emits the file as an asset and points the URL at
it. In Node, `loadShaper` reads the copy in the `harfbuzzjs` package instead.

No top-level `await` reaches the bundle, so any target esbuild accepts works, ES2020
included: harfbuzzjs's JavaScript is vendored here with its initialization left to
`loadShaper`, since its published module awaits the WebAssembly at the top level.
