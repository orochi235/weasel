---
'@weasel-js/core': patch
---

A scene write repaints the canvas instead of re-rendering `SceneCanvas`.

`SceneCanvas` held a `useSyncExternalStore` on the scene's version whose only
effect was to force a render — it discarded the value. Every mutation therefore
committed the whole canvas subtree, including for hosts that had asked not to
be re-rendered: `useScene(..., { subscribe: false })` gated the host's own
subscription but was invisible to `SceneCanvas`, which subscribed anyway. A
frame loop writing poses paid a React render per write.

It now subscribes for a repaint, the way the pose-override channel beside it
already did. The layers read the scene at paint time and `contentVersion` is a
getter, so nothing about drawing the new content needed the commit.

**This changes when scene-derived DOM updates.** DOM now lands on the render of
whoever subscribed for it, rather than riding along on the canvas's. In practice
every consumer already subscribes: `useScene` does by default, `SelectionPanel`
subscribes itself, and panels an app hangs beside the canvas re-render with the
host that owns the scene. A consumer that renders node data as DOM while
holding no subscription of its own — reading a `Scene` it got from somewhere
other than `useScene`, and relying on the canvas to re-render it — needs to
subscribe. Selection is unaffected: it reaches the render body through
`useSelection`'s own store subscription and still commits.

`docs/concepts.md` said a scene change leads with DOM. It no longer does, and
that section is rewritten.
