# @weasel-js/svg

SVG import/export for @weasel-js/core: parse SVG strings into weasel-native shapes and serialize them back.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/svg
```

## Usage

```ts
import { /* … */ } from '@weasel-js/svg';
```

## Text fidelity

Two things worth knowing before you rely on a text round-trip.

**The format is exactly as expressive as the runs model.** A run can turn
`underline` on but not off, so `<g text-decoration="underline"><text
text-decoration="none">` has no representation on the way in — and neither
does "this word is not underlined inside an underlined node" on the way out.
That is not loss in the serializer; it is the model, faithfully reproduced. A
future "un-underline this word" feature needs a model change, not a
serializer change. (Contrast `letterSpacing`, where the model *was* more
expressive than the serializer — that was a real data-loss bug, since fixed.)

**Decoration is treated as inherited.** Real CSS says `text-decoration` is
not inherited and cannot be cancelled by a descendant; a browser shown
`<g text-decoration="underline"><text text-decoration="none">` still
underlines. This parser reads it as not-underlined. A deliberate difference:
for a document editor, honoring the child's stated intent is the friendlier
answer, and the alternative is unrepresentable anyway (see above). It only
shows up on foreign SVG that sets decoration on a group and cancels it on a
child.

## License

MIT
