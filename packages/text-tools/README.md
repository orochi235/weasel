# @weasel-js/text-tools

Text for a weasel canvas: the text node kind, its in-place editor, and the text
and sticky-note tools, as presets an app turns on beside core's own.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/text-tools).

```sh
npm install @weasel-js/text-tools
```

Core knows no text. A canvas whose scene holds text nodes (data with a string
`text`) turns them on with `textTools.text`:

```tsx
import { SceneCanvas } from '@weasel-js/core';
import * as textTools from '@weasel-js/text-tools/presets';
import * as presets from '@weasel-js/editing/presets';

<SceneCanvas scene={scene} features={[presets.draw, textTools.textTools]} />;
```

| Preset | What it adds |
|---|---|
| `textTools.text` | the `kit:text` painter, whose glyphs are its outline for booleans and Create Outlines; `'text'` routing and properties; the `text` and `sticky` inserts; the canvas's own editor and the `textEdit` dep; `enterTextEdit`, a double-click opening text in place, and a click opening a path effect's hidden text; plain-text paste |
| `createTextPreset({ editor })` | the same, with the editor configured by `useSceneTextEdit`'s options, or `editor: false` for none |
| `textTools.textTools` | the text and sticky-note tools, with `textTools.text` |
| `textTools.whiteboard` | the pencil, text and the sticky note on an open canvas, with view, pick, move, resize and edit |

A canvas taking its tools through `<SceneCanvas tools>` gets the same two from
`useTextToolsTools()`, beside `textTools.text`. A scene drawn with no canvas
(`renderSceneToPixels`, an export) paints text once `TEXT_PAINTER` is
registered for it: `nodeShapesOf(scene).register(TEXT_PAINTER)`.

The text engine itself (runs, styles, layout, measurement, glyph outlines) is
`@weasel-js/text`; the DOM editing surface is `@weasel-js/text-dom`.
