---
'@weasel-js/core': patch
---

Restore a displaced action when the registrant that displaced it unregisters.

The actions registry held one `Action` per id, so two `<SceneCanvas>` instances under one `<ActionsProvider>` collided: the second to mount displaced the first's `viewport.wheelPan` / `viewport.zoom` / `viewport.pinchZoom`, and its teardown then deleted the entry outright rather than uncovering what it had displaced. The canvas still on screen was left with no viewport actions at all — wheel pan and Cmd+wheel / Cmd+- / Cmd+0 dead, with no error. The `vertex-widths`, `curve-lab` and `rotated-resize-math` demos all mount several canvases this way.

`register` now stacks registrants per id, newest live, and the unregister it returns takes its own entry out wherever that entry has since ended up. So a displaced registrant becomes live again when the one above it leaves, and a registrant that was already displaced still disturbs nothing when it goes. Last-writer-wins is unchanged while both are mounted.

This closes the same hole for every other hook that registers a fixed id into a shared registry — `useStandardActions`, `useToolActions`, `useKeybindings`, `useContributions` — and lets `useActionsPropResolver` drop its restore hack, which re-registered a stale snapshot on cleanup and never took it off again.

`unregister(id)` is unchanged and still drops every registrant of that id: it is the "this action should not exist" door, not a release.
