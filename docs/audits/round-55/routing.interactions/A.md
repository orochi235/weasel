I couldn't write `.skulk/out/findings.md` because the permission request wasn't granted, so the full findings document is below. One more thing: the checkout's `HEAD` is `830b463cc1`, not the frozen commit `bfc55709b4…` the brief names, so I read whatever is in that working tree.

## browserReservedChord ignores a KeySpec's `code`, so a binding that fires on a reserved chord by physical key is reported free
- where: packages/routing/src/interactions/browserReservedKeys.ts:55 (browserReservedChord)
- scenario: `KeySpec.code` is "tried before `key`, and either matching is enough" (gestures/ui/spec.ts). A spec `{ kind: 'key', key: 'ρ', code: 'KeyR', mods: { mod: true } }` (a Greek-layout label on the R key) fires on Cmd/Ctrl+R, which is the browser's reload. `browserReservedChord` only lowers `spec.key` and checks those against the table, so it returns `null` and the spec counts as safe. It should also map each `code` (`KeyX` → `x`, `Escape` → `escape`) and check those keys.
- evidence: read
- severity: low

## A sweep with non-primitive keys re-enters the same item on every move
- where: packages/routing/src/interactions/sweep/sweep.ts:127 (createSweepAction → reach)
- scenario: `K` is generic and `keyOf` is asked fresh on each hit-test. A grid surface whose `keyOf` returns `{ row, col }` builds a new object on every call. `!Object.is(item.key, current.key)` is then always true, so `run.enter` fires for each sub-step of each move while the pointer stays on one cell. A toggle sweep flips that cell back and forth many times per move. It should enter an item only when the item under the pointer changes. Comparing `item.element` alongside the key, or documenting that `K` must be compared by identity, would close this.
- evidence: read
- severity: low

## thresholdDrag with `captureAt: 'threshold'` reports a far-travelled release as a click
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:84-92 (startThresholdDrag)
- scenario: with `captureAt: 'threshold'` nothing is captured until a move passes the threshold. A press followed by a fast flick off the window can leave the window before any in-window move crosses the threshold. The `pointerup` outside is then never delivered. The next `pointermove` back in has `buttons: 0`, and `openPointerSession` reads it as the missed release and calls `onEnd` before `onMove` runs. Because `maybeActivate` never ran on that event, `activated` is still false and `opts.onClick(ev)` fires, even though the pointer is now far past the threshold. A click should mean a release within the threshold. The end path should test `pastDragThreshold(start, ev, …)` before choosing `onClick`, or treat that case as a cancel.
- evidence: read
- severity: low

## thresholdDrag's Escape cancels mid-IME-composition, where pointerSession's own Escape does not
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:74-79 (onKey)
- scenario: `openPointerSession`'s `escape` handling skips `e.isComposing` (pointerSession.ts:166), so an Escape that dismisses an IME candidate window leaves the drag alone. thresholdDrag runs its own window-capture Escape listener without that check. During a live drag, an Escape pressed to dismiss composition in a focused field cancels the drag and is `preventDefault`ed and stopped, so the IME never sees it. The same question gets two answers in two places. thresholdDrag should skip `isComposing` too, or use the session's `escape` option.
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

<!-- done: 4 findings, files read: 13 -->