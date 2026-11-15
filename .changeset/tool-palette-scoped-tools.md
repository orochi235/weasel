---
'@weasel-js/ui': minor
---

`ToolPalette` without a `tools` prop draws the tools of the canvas it sits in, or beside under a shared `WeaselProvider`.

A palette beside a canvas no longer needs `onToolsCreated` and state to hold the canvas's tools:

```tsx
<WeaselProvider>
  <ToolPalette orientation="horizontal" />
  <SceneCanvas scene={scene} features={[drawPreset]} />
</WeaselProvider>
```

<!-- entry: api new -->
