# Annotate lab follow-ups

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**What this is:** six defects and gaps found by actually using the annotate lab after arc 4 merged. Each one below is diagnosed against the code, not guessed. Two are already fixed.

**Where the work is:** `main` is at `25f6ee3b` (arc 4, merged, unpushed — `origin/main` is 134 commits behind). Branch `fix/pencil-ghost` holds item 2. The primary checkout was detached at `main`; `main` itself lives in the `.claude/worktrees/trunk` worktree.

**To see the lab:** `npm run dev:annotate --workspace=@weasel-js/labkit` (port 5188). The site's capture demo is `npm run dev:kit` → `#annotation-capture`.

---

## 1. The freehand cursor

`usePencilTool` declares `cursor: 'crosshair'`, and that is what the pane reports — so does `rect` and `line`. Crosshair is right for placing a corner precisely; for a freehand stroke it says nothing about what the tool does, and every drawing tool looks identical.

**Needs a decision before building:** which cursor. A pencil-tip cursor from a `data:` URI with its hotspot at the tip is the usual answer, and `PencilIcon` already exists to derive it from — but a 20×20 glyph is not a cursor, and per `CLAUDE.md` a drawn cursor gets proofed at 10–15× and then checked again on the pixel grid at 1× and 2×.

- [ ] Ask which cursor, or ask for a sketch.
- [ ] `packages/core/src/tools/builtin/pencil/usePencilTool.tsx` is the one line that changes.

## 2. The freehand ghost drew a marquee — FIXED

`useDispatcherOverlayLayer.ts` built the pencil preview with `polygonFromPoints`, which closes the path, so the edge from the newest sample back to the first swept across the drawing as the stroke grew. The comment above it said "Open polyline preview". The anchor dot came too, which marks a growth axis a freehand stroke does not have.

Fixed on `fix/pencil-ghost` (`42d13224`): new `polylineFromPoints` in the path builder, and the anchor dot is suppressed for `shape === 'pencil'`.

- [x] Fixed, verified in the browser, 1241 core tests green.
- [ ] Not yet covered by a test. A screenshot test over the ghost, or a unit test asserting the preview path carries no `PATH_Z`.

## 3. The lab is too tall

Not a kit flaw, but not the demo's fault either — it is the two ends disagreeing. `LabShell.less` sets `height: 100vh`, which is right for a lab that owns the page. The site embeds one in `.ckd-lab-frame { height: 560px }`, and the instrument's own content is 240×160, so the trial's content well is mostly empty.

**Needs a decision:** whether a `<Lab>` should be able to shrink-wrap its content at all. Today it always fills its container, and nothing in the API says otherwise. The options are a prop on `<Lab>` (`fit="content"`), the demo picking a smaller frame, or the instrument centring in the well it is given.

- [ ] Decide, then implement in `LabShell.less` + `Trial.less` or in `canvas-kit-demo.css`.

## 4. Drags miss their release when the pointer leaves

The systemic one, and it is real. In `useGestureDispatcher.tsx`:

- `setPointerCapture` is taken best-effort on pointerdown, and listeners sit on the input element. That is the right shape — capture retargets the later events — but nothing detects capture being **lost**. The browser fires `lostpointercapture` when the capturing element is removed or capture is revoked; **`lostpointercapture` appears nowhere in this repo**. After that the pointer is outside the element, no `pointerup` arrives, and the gesture never ends.
- There is no `buttons === 0` recovery. A `pointermove` arriving with no button held means the release happened somewhere the page never heard about — the standard cheap recovery, and it costs one comparison.
- `onWindowBlur` (line 697) releases **held keys only**. An in-flight drag survives an alt-tab.

- [ ] End the in-flight gesture on `lostpointercapture`.
- [ ] End it on a `pointermove` whose `buttons` is 0 while a drag handle is live.
- [ ] Extend `onWindowBlur` to end in-flight drags, not just keys.
- [ ] Test the way `CLAUDE.md` says to: jsdom implements `setPointerCapture` as a recorder that does nothing, so a test asserting "the drag ended" can pass against a broken implementation. Assert the proxy on this side of the boundary and say in the test that it is one.

**The wider problem, which is a separate arc.** Four drag lifecycles exist with four different policies: the dispatcher, `handleDrag` (element listeners + capture), `thresholdDrag` (capture + `document` listeners) and `pointerDrag` (`document` listeners, no capture). Fixing the dispatcher fixes tools; the other three keep their own holes. Filed in `docs/TODO.md`.

## 5. The lab has no zoom controls — the gate is wrong

labkit already contributes zoom out / zoom in / actual-size / the zoom slider, in `chrome/builtins.tsx:103` — behind `instrument.canvas != null`. An annotating instrument whose content is DOM or SVG declares no `canvas`, so it gets none of them, even though every annotation target carries a `view` that is exactly a camera.

- [ ] Widen the gate, or give `annotations` its own viewport contribution. The second is probably right: the trial's `ctx.zoom`/`setZoom` drive the *trial's* view, and an annotation target's camera is per target — those are not the same number, and conflating them is how the zoom slider ends up moving the wrong thing.

## 6. One image per trial, and a workspace-wide palette

**This reverses a decision arc 3 made deliberately.** `Trial.tsx:198` gives a trial its own tool slot when its instrument declares `annotations`, with the stated reason: "two trials annotating different pictures must not share one active tool." Sharing the palette across the workspace is the opposite. It may well be the better call now that a trial is meant to hold one image — but it is a reversal, not an oversight, and whatever replaces the old reason should be written down.

- [ ] Decide: one tool slot for the lab, or one per trial with a shared palette *widget*. These are different — the second keeps the arc-3 behaviour and only moves the chrome.
- [ ] `PartInspector` becomes one pane per trial; the two-pane comparison moves to two trials.
