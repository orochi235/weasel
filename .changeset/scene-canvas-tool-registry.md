---
'@weasel-js/core': patch
---

Fixes: a shape kind added to `KIT_SHAPE_KINDS` did not get a built-in tool on `<SceneCanvas>`, because the canvas spelled the kinds out by hand. It now resolves its built-in tools from `BUILTIN_TOOL_IDS` in one place.

Breaking: `createPenPreviewLayer` takes the pen's `state` (a `PenScratch`) where it took `penTool`. The pen tool now declares the preview as its own overlay, so `<SceneCanvas>` no longer builds it and the layers map has no `penPreview` key. A pen passed through a `tools` takeover, or a consumer's own `usePenTool`, draws its preview without being wired to one.

Changes behavior: the pen's preview sits directly beneath the selection overlay, and it is hidden while a mode forbids the pen's capabilities, as the tool's other chrome is. The path in progress is kept and shows again when the mode allows it. Holding a hotkey tool mid-draw still shows it.

Breaking: `useKeybindings` takes `modes` where it took `isToolEligible`, and asks the mode registry about each tool's own capability tags.

Adds API: `inertia: true` on `useHandTool` and on the `viewport.dragPan` action's params means the kit's default inertia, as it already does on `<SceneCanvas viewport>`.
