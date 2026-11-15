---
'@weasel-js/core': minor
---

`useScopedTools()` returns the tools of the canvas it sits in, or of a canvas beside it under a shared `WeaselProvider`.

It is the `ToolsApi` that `onToolsCreated` hands over, kept current, so a toolbar beside a canvas needs no state of its own to hold it. It is `null` until a canvas in scope mounts.

<!-- entry: api new -->
