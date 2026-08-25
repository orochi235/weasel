# Mac trackpad pinch zoom — in progress

**Worktree:** `.claude/worktrees/mac-pinch-zoom`, branch `mac-pinch-zoom`, based on `main` at
`7b0f20b8`. Nothing pushed.

**What this is:** three pre-existing bugs, found because the user reported "the viewport demo's pinch
to zoom doesn't work". On a Mac trackpad it zooms the browser page instead of the canvas. Unrelated
to the frame-loop arc — every file involved is byte-identical between `main` and that branch.

## The bugs

1. **A trackpad pinch matches no binding.** `matchModifiers`
   (`packages/gestures/src/ui/match.ts:71-101`) treats `mods: { mod: true }` as platform-*exclusive*:
   on Mac it requires `meta` and leaves `ctrl` **forbidden**. A trackpad pinch is
   `wheel { ctrlKey: true, metaKey: false }`, so it fails both checks; `viewport.wheelPan` forbids
   ctrl too. Unmatched means the dispatcher never calls `preventDefault`, so native page zoom runs.
   Fix is a dedicated `mods: { ctrl: true }` binding on `viewport.zoom` — **not** relaxing `mod`,
   which would make Ctrl+click equal Cmd+click kit-wide (Ctrl+click is the macOS context menu).
   `viewportZoom.ts:5-6` claims this path already covers trackpad pinch; it is inverted.

2. **The whole suite runs as non-Mac.** `IS_MAC`
   (`packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:61-65`) uses
   `navigator.platform ?? navigator.userAgent`; jsdom's `platform` is `''`, which is not nullish, so
   the UA fallback never fires. **Every Mac-specific binding in this repo is currently untested.**
   `??` should be `||`.

3. **`viewport.pinchZoom: true` double-applies.** `pinchZoomAction` is already unconditional in
   `useStandardActions.ts:161`; the flag additionally mounts the legacy hook at `Canvas.tsx:925`.
   Measured `[2]` vs `[2, 4]` — the demo's own opt-in breaks the path that worked by default.
   `Canvas.viewport.test.tsx:58` is `it('mounts without error when viewport.pinchZoom=true')`, which
   is why it survived.

## Also in scope

`apps/site/registry.ts:343` and `ViewportDemo.tsx:100` advertise behavior that does not exist: pinch
on Mac trackpads (see bug 1) and eased keyboard zoom. **`animatedZoom` is dead config** — declared at
`SceneCanvas.tsx:600`, read by nothing. The claim is being removed; the prop stays.

## Decided, not started: implement `animatedZoom` on the animation system

The user's call. The zoom action tweens through `Animator`; `useViewTween`'s bespoke rAF loop — its
own `lerp`, its own private `easeOutCubic` while `animation/easings` exports that plus ~40 more —
folds into it or is deleted. Lands **after** the frame-loop arc merges: driving the view per tick is
only free once `setView` costs no render. Restore the blurb claims when it ships.

## Out of scope, known

- No Safari `gesturestart`/`gesturechange` handling exists anywhere — the other trackpad channel.
- `usePinchGesture` tracks the first two pointers by insertion order, so lifting one of three fingers
  silently re-bases onto a different pair.
