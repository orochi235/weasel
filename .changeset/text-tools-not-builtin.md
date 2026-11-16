---
'@weasel-js/core': major
---

The text and sticky-note tools are no longer core built-ins; mount them with `@weasel-js/text-tools`' `textToolsPreset` or `useTextToolsTools()`.

This is breaking. `BuiltinToolId` and `SHAPE_KINDS` lose `text` and `sticky` (and the `text` descriptor field and the `'type'` family), so `defaultTools` cannot name them. `TYPE_TOOLS` is text-tools' `TEXT_TOOLS`, `typeToolsPreset` its `textToolsPreset`, and `whiteboardPreset`, `WHITEBOARD_TOOLS`, `useTextTool`, `TEXT_TOOL_OPTIONS`, `useStickyTool`, `STICKY_TOOL_OPTIONS`, `stickyData`, `stickyNodeFactory` and `STICKY_DEFAULTS` moved there; `textEditPreset` is part of `textPreset`. `BuiltinToolOptions.sticky` is `createTextToolsPreset({ sticky })`. Named presets `'tools:type'`, `'textEdit'` and `'whiteboard'` are gone from `namedFeatures`. `TOOL_GROUP_ORDER` no longer names the `type` group, so a palette showing text-tools' tools passes its own `groupOrder`.

```tsx
// before
<SceneCanvas features={[drawPreset, typeToolsPreset]} />
// after
<SceneCanvas features={[drawPreset, textToolsPreset]} />
```

<!-- entry: rank=5 breaking api -->
