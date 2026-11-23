# Findings: forge.shell.loupe (audit round 73)

## A Live lens cell whose comparison toggles between none and some leaves its old request standing in `LiveLenses`
- where: packages/forge/src/shell/loupe/liveSource.ts:118 (createLiveSource → attach → post / update)
- scenario: `LensSlot` passes a changed `conditions` (or lensId) through `handle.update(next)` rather than re-attaching. `update` sets `request = next` and `measure()` posts under `liveCellId(next.lensId, next.conditions)`, e.g. `lens-0~compared`, but nothing withdraws the id the cell posted under before (`lens-0`). Both requests point at the same `slot: target`, so the trial renders two copies into one lens (the stale one at the old globals/args). `detach` withdraws only the current id, so the stale request outlives the lens and the trial keeps a copy mounted into a removed node. Expected: when the cell id changes, `lenses.set(oldId, null)` before posting under the new one.
- evidence: read (LensSlot.tsx:86-90 updates with `conditions` as a field)
- severity: high

## Capture state is refused for undefined entries that config strips, and for an undefined state
- where: packages/forge/src/shell/loupe/capturePayload.ts:84 (capturePayload / sendable)
- scenario: config goes through `withoutUndefined` before `sendable`, on the grounds that "a story reads as unset either way". State does not. A state of `{ hovered: undefined }` round-trips to `{}`, the key counts differ, and the capture says STATE_UNSENDABLE. A story with no state at all (`state === undefined`) fails too: `JSON.stringify(undefined) ?? 'undefined'` makes `JSON.parse` throw. Expected: state treated like config (undefined entries stripped, and undefined allowed as no state).
- evidence: read
- severity: medium

## A successful capture never clears a status a 503 set, and nothing re-polls
- where: packages/forge/src/shell/loupe/captureClient.ts:62 (createCaptureClient → take)
- scenario: one POST answers 503 (the capture browser was restarting), so `setStatus(reason)`. Later POSTs succeed and return bitmaps, but `status` stays at the reason, because only `poll` ever sets `true`, and `poll` runs only on a new subscribe or attach. The source reports itself unavailable while it serves captures, and labkit falls back or shows the reason until the user reattaches a lens. Expected: a successful `take` sets the status to `true`, or a 503 schedules a re-poll.
- evidence: read
- severity: medium

## The token chain cache misses CSSOM edits to existing sheets
- where: packages/forge/src/shell/loupe/tokenChain.ts:236 (revisions / tokenChain key)
- scenario: the cache key counts DOM mutations to `<style>`/`<link>` and the number of sheets. A sheet edited through the CSSOM (`insertRule`/`deleteRule` on an existing sheet, `replaceSync` on an adopted sheet, as CSS-in-JS and constructed-sheet libraries do) changes no DOM node and no count. If the element's computed value happens to stay the same, as when a rule is re-pointed to a different token that resolves to the same color, `tokenChain` returns the stale chain and the Token readout names tokens that no longer apply.
- evidence: read
- severity: low

## Files read
packages/forge/src/shell/loupe/CaptureInputs.tsx
packages/forge/src/shell/loupe/CompareMenu.tsx
packages/forge/src/shell/loupe/ForgeLoupe.tsx
packages/forge/src/shell/loupe/LiveCopies.tsx
packages/forge/src/shell/loupe/captureClient.ts
packages/forge/src/shell/loupe/captureContext.ts
packages/forge/src/shell/loupe/capturePayload.ts
packages/forge/src/shell/loupe/conditions.ts
packages/forge/src/shell/loupe/frameScroll.ts
packages/forge/src/shell/loupe/liveLenses.ts
packages/forge/src/shell/loupe/liveSource.ts
packages/forge/src/shell/loupe/loupe.css
packages/forge/src/shell/loupe/pixels.fixture.ts
packages/forge/src/shell/loupe/pixelsLens.ts
packages/forge/src/shell/loupe/pixelsSource.ts
packages/forge/src/shell/loupe/readouts.tsx
packages/forge/src/shell/loupe/tokenChain.ts
packages/forge/src/shell/loupe/trialAt.ts
packages/forge/src/shell/loupe/usePixelsSource.ts

<!-- done: 4 findings, files read: 19 -->
