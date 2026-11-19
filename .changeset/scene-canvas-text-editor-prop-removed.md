---
'@weasel-js/core': major
---

`<SceneCanvas textEditor>` is gone: configure the canvas's own text editor with `createTextPreset({ editor })` from `@weasel-js/text-tools`.

This is breaking. `editor` takes `useSceneTextEdit`'s options as the prop did, or `false` for none; `SceneCanvasTextEditor` is text-tools' `CanvasTextEditorOptions`.

```tsx
// before
<SceneCanvas textEditor={{ escape: 'commit' }} features={[presets.draw]} />
// after
const text = useMemo(() => createTextPreset({ editor: { escape: 'commit' } }), []);
<SceneCanvas features={[presets.draw, text]} />
```

<!-- entry: breaking api -->
