---
'@weasel-js/core': major
'@weasel-js/routing': minor
---

`useScopedTools`, the tool-option hooks and `tuneToolOptions` move from `@weasel-js/core` to `@weasel-js/routing`.

This is breaking: import `useScopedTools`, `useToolOptionParams`, `useToolOptionValues` and `useToolOptionTunings` from `@weasel-js/routing/react`, and `tuneToolOptions` from `@weasel-js/routing`. `ToolsScope`, `usePublishTools` and `useCanvasToolOptionValues`, which a canvas uses to publish its tools and options, are exported there too.

<!-- entry: breaking api -->
