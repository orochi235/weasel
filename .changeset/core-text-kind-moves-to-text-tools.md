---
'@weasel-js/core': major
'@weasel-js/text-tools': minor
---

Core no longer paints, routes, inserts or edits text; a canvas turns text on with `@weasel-js/text-tools`' `textPreset`.

This is breaking. `kit:text` is no longer a built-in painter, `inferredNodeRouting` has no `'text'`, `defaultNodeProperties` and `inferredNodeProperties` carry no text kind, the `insert` dep builds no `text` or `sticky` node, and no canvas mounts a text editor of its own. `textPreset` brings all of them back, with `enterTextEdit`, `editTextAt` (a double-click opening text in place) and `editEffectText`. A scene drawn with no canvas paints text once its painter is registered.

```tsx
import { textPreset, TEXT_PAINTER } from '@weasel-js/text-tools';

<SceneCanvas features={[drawPreset, textPreset]} scene={scene} />;
nodeShapesOf(scene).register(TEXT_PAINTER); // for renderSceneToPixels, an export
```

`textBoxOf`, `TextNodeData`, `TextOverflow`, `textFrameOf`, `edgeColor`, `TextEdge`, `TextFrame`, `TextShadow`, `useSceneTextEdit`, `UseSceneTextEditOptions`, `UseSceneTextEditReturn`, `DefaultTextData`, `textEditJoin`, `EditingDrawOne`, `createTextLayer`, `enterTextEditAction` and `editTextAtAction` are imported from `@weasel-js/text-tools`.

<!-- entry: rank=20 breaking api -->
