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
`text`) turns them on with `textPreset`:

```tsx
import { drawPreset, SceneCanvas } from '@weasel-js/core';
import { textPreset, textToolsPreset } from '@weasel-js/text-tools';

<SceneCanvas scene={scene} features={[drawPreset, textToolsPreset]} />;
```

| Preset | What it adds |
|---|---|
| `textPreset` | the `kit:text` painter, whose glyphs are its outline for booleans and Create Outlines; `'text'` routing and properties; the `text` and `sticky` inserts; the canvas's own editor and the `textEdit` dep; `enterTextEdit`, a double-click opening text in place, and a click opening a path effect's hidden text; plain-text paste |
| `createTextPreset({ editor })` | the same, with the editor configured by `useSceneTextEdit`'s options, or `editor: false` for none |
| `textToolsPreset` | the text and sticky-note tools, with `textPreset` |
| `whiteboardPreset` | the pencil, text and the sticky note on an open canvas, with view, pick, move, resize and edit |

A canvas taking its tools through `<SceneCanvas tools>` gets the same two from
`useTextToolsTools()`, beside `textPreset`. A scene drawn with no canvas
(`renderSceneToPixels`, an export) paints text once `TEXT_PAINTER` is
registered for it: `nodeShapesOf(scene).register(TEXT_PAINTER)`.

The text engine itself (runs, styles, layout, measurement, glyph outlines) is
`@weasel-js/text`; the DOM editing surface is `@weasel-js/text-dom`.
