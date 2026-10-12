---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

renderer: a new package holding the WebGL2 renderer, moved out of core. `WeaselRenderer` draws a `DrawCommand[]`; `cullDrawCommands` drops what cannot reach a rectangle; `registerProgram`, `registerTexture`, and `registerEffect` add shaders, textures, and full-screen passes. It depends on `@weasel-js/geom`, `@weasel-js/paint`, `@weasel-js/registry`, `@weasel-js/stroke`, and `@weasel-js/text`, with `@weasel-js/font` as a peer, and has no scene and no React.

Everything `@weasel-js/core/renderer` exported is exported from `@weasel-js/renderer`. So are `isPaintKindKnown` and `warmPaintKinds`, `fillInPoseFrame` and `fillToBoundsFrame`, `commandFill` and `commandStroke`, `createTilePattern`, `resolvePatternSpec`, `resolveFillPattern`, `isPatternSpec`, the image cache (`getImageBitmap`, `imageStatus`, `releaseImage`, `retryImage`, `subscribeImageReady`, `isVectorImageSrc`), and `textCommand`, `textCommandFromRuns`, and `textCommandFromPose`.

These were not exports of `@weasel-js/core` before and are additions: `getProgramSource`, `strokeReachAt`, `boundsMissRect`, and the draw-kind registry a paint kind's draw slots live in (`registerPaintDrawKind`, `registerPaintDrawKindLoader`, `getPaintDrawKind`, `paintDrawKindRegistry`).

The mesh gradient is at `@weasel-js/renderer/mesh`, the named pattern tiles at `@weasel-js/renderer/patterns-builtin`, the recording WebGL2 stand-in at `@weasel-js/renderer/testing/glRecorder`, and the reset seams at `@weasel-js/renderer/test-seams`.

`@weasel-js/core`, `@weasel-js/core/renderer`, `@weasel-js/core/mesh`, and `@weasel-js/core/patterns-builtin` still export every name they did before.
