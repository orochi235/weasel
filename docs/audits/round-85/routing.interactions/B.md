# Audit round 85 — routing.interactions (blind reviewer)

## A carry whose release went unseen drops its payload at the next move's point
- where: packages/routing/src/interactions/carry/carry.ts:133 (startCarry, `onEnd`), via packages/routing/src/interactions/pointerSession/pointerSession.ts:155 (`onMove` missed-release rule)
- scenario: the release happens where the document never sees it (over another window, inside a native drag, an element that swallowed it). The next pointermove arrives with `buttons: 0`, and the session reports it through `onEnd` as a release. `startCarry` then runs `step(e)` and `receive('drop', …)` on whatever surface sits under that move, so a payload the user let go elsewhere is dropped on a surface they never released over, and `onEnd({ taken: true })` reports success. The session's own repress rule treats an unseen release as "where it ended is unknown — so this cancels". A carry should do the same with a missed release: `leave` and `onCancel`, not a drop. `thresholdDrag` has the same problem in a milder form: a missed release on a press below the threshold fires `onClick` (thresholdDrag.ts:94).
- evidence: read
- severity: medium

## `undoKeyStep` takes a text field inside a shadow root for a non-editable target and hands its Cmd+Z to the page
- where: packages/routing/src/interactions/keyHelpers.ts:75 (undoKeyStep)
- scenario: a page-level keydown listener on `document`/`window` calls `undoKeyStep(e)`, and focus is in an `<input>` or `<textarea>` inside an open shadow root (a web component). At that listener `e.target` has been retargeted to the shadow host, and `isEditableTarget(host)` is false. The function returns `'undo'`, so the page undoes its history and the field's own text undo is lost. It should test the focused element (`e.composedPath()[0]`), not the retargeted `target`.
- evidence: read
- severity: medium

## `useHandleDrag` measures its box once, so a scroll during the drag shifts every reported point
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:88 (useHandleDrag, `box = layoutBoxOf(rectEl)`)
- scenario: a handle is pressed, and during the drag the page or a scroll container scrolls (wheel while dragging, or autoscroll). `box.left`/`box.top` are client coordinates from the press, so `localOf` subtracts stale offsets, and `onMove`/`onEnd` report points off by the scroll delta even though the pointer has not moved relative to the svg. The freeze was meant to stop the handle's own movement from shifting its space. It also freezes against scroll, which needs the box's offset re-read (or the scroll delta added back).
- evidence: read (inferred behavior, not run)
- severity: low

## The reserved-chord table cannot express Ctrl+Tab, so the tab switcher's chords are never reported
- where: packages/routing/src/interactions/browserReservedKeys.ts:28 (BROWSER_RESERVED_CHORDS) and :63 (browserReservedChord, `if (!allows(other, false)) return null`)
- scenario: Ctrl+Tab and Ctrl+Shift+Tab switch tabs in every major browser, on macOS too, and a page cannot take them. `browserReservedChord({ kind: 'key', key: 'Tab', mods: { ctrl: true } })` returns `null` on every platform: the table has no `tab` entry, and a `ReservedChord` has only `mod`, with no way to say "Ctrl on Apple". So on Apple any spec that holds Ctrl returns `null` at the early exit. Ctrl+Cmd chords (Ctrl+Cmd+F fullscreen, Ctrl+Cmd+Q lock screen) fall through the same hole. The header says the list "errs toward listing a chord".
- evidence: read
- severity: low

## `startThresholdDrag` takes and releases its late capture itself, beside the session's own `capture()`
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:47 (releaseLate) and :60 (maybeActivate)
- scenario: `PointerSession.capture()` exists for exactly this case: a session opened with `capture: false` that captures once the press turns into a drag, and is released at teardown. `startThresholdDrag` instead calls `setPointerCapture` and `releasePointerCapture` on its own and keeps a second release path. So the session thinks it holds no capture (`captured` stays false) while the origin does hold one, and the same decision is made in two places that can drift (whose pointerId, when to release, the try/catch). It should call `session.capture()` at the threshold and drop `releaseLate`.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 5 findings, files read: 13 -->
