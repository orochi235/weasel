---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

labkit's loupe routes its peek key and its wheel through the gesture dispatcher, as the `loupe.peek` and `loupe.magnify` actions, instead of attaching `keydown`/`keyup`/`blur` on the window and a capture-phase `wheel` on the host. Taking the wheel from a lab's pan/zoom is now the dispatcher's ordinary rule — `loupe.magnify`'s `enabled` declines while the lens is down, so the event goes unhandled and falls through, and while the lens is up the dispatcher stops propagation before React's root listener runs. Aiming the lens stays a plain `pointermove` listener: the gesture grammar names no hover.

`useGestureDispatcher` takes `channels`, switching off any of the four listener groups it attaches to its element — `pointer`, `wheel`, `contextMenu`, `ingest`. Every one defaults on, so nothing changes for a caller that omits it. A mount that wants one gesture should not also have to take the rest of the pipeline's side effects: `contextMenu` suppresses the native menu unconditionally, and `ingest` makes the element a file-drop target. The loupe mounts with three of the four off, which is what keeps right-click and drops working on a lab that turns a magnifier on.

`<LoupeGestures>`, `createLoupeActions` and `LoupeInputApi` are new on `@weasel-js/labkit/loupe`; `useLoupe`'s returned state carries a new `input` member that `<LoupeGestures>` drives the lens through.
