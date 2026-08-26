---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Stop every frame loop while nothing can see it

New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
whether a frame may run: nothing runs while `document.hidden`, and a loop that
names an element also stops while that element is outside the viewport. A
request made while suspended is held rather than dropped and re-armed on
resume, so a loop never polls visibility or needs restarting by hand.

Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
`useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
`useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
it paints only dirty layers, but a hidden tab still commits React updates and
its view/size effect marks every layer dirty.

Loops measuring elapsed time rebase their clock through the new `onResume`
option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
meter reporting a rate nobody achieved, a tween jumping to its end value on
return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
export; nothing in the tree sets it.

`npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
in kit source, and runs in CI.
