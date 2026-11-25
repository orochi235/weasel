# Audit round 85 — routing.interactions (reviewer findings)

## browserReservedChord never reports the tab-switching chords, and on Apple can never report a chord that needs Ctrl
- where: packages/routing/src/interactions/browserReservedKeys.ts:28 (BROWSER_RESERVED_CHORDS), :61 (browserReservedChord)
- scenario: a kit default bound to `{ kind: 'key', key: 'Tab', mods: { ctrl: true } }` (or `PageDown`/`PageUp` with ctrl, or Cmd+Alt+ArrowLeft/Right on macOS) is one Chrome keeps for itself (next/previous tab) before the page sees it. The table holds only single-character keys (built by spreading strings through `chord`) plus Escape, so none of these are listed; and on an Apple platform `other` is `m.ctrl`, so any spec that requires Ctrl returns `null` before the table is even consulted — Ctrl+Tab on macOS can never be flagged. The function answers "not reserved" for chords the header says it errs toward listing.
- evidence: read
- severity: medium

## handleDrag and thresholdDrag keep a drag open across a window blur, and later commit it, where carry and the dispatcher cancel
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:91 (useHandleDrag onPointerDown); packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:83 (startThresholdDrag)
- scenario: press a handle, drag, Cmd+Tab away and release in another app. `carry.ts` (and the dispatcher's `attachInput` `onWindowBlur`) cancel on blur because "the release after a lost focus may never come". `useHandleDrag` and `startThresholdDrag` add no blur listener, so the session stays open; on return the first move reports `buttons: 0`, which `openPointerSession` reads as a missed release and ends with `onEnd` — the drag is committed at wherever the pointer re-entered (thresholdDrag below threshold even fires `onClick`). The same question (what does a blur mid-drag mean) is answered as cancel in one place and as commit-at-reentry in the other two.
- evidence: read
- severity: medium

## startThresholdDrag reports a missed release below the threshold as a click
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:91 (onEnd)
- scenario: press without passing the threshold, then the release lands somewhere the document never hears (another window, a listener that swallows `pointerup` at window capture). The next `pointermove` with `buttons: 0` is turned by `openPointerSession` into `end(move)`, and `startThresholdDrag` calls `opts.onClick(move)` — a click the user never made on the pressed element, at the move's coordinates. A release of unknown place should not read as a click; it should cancel, as `onRepress` does for the same "release never seen" situation ("where it ended is unknown — so this cancels").
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

<!-- done: 3 findings, files read: 13 -->
