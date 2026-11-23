## A Live lens cell whose comparison turns on or off under one handle leaves its old request standing
- where: packages/forge/src/shell/loupe/liveSource.ts:96 (attach → post / update / detach)
- scenario: `post` and `detach` key the request by `liveCellId(request.lensId, request.conditions)` read from the *current* request. labkit's `LensSlot` (packages/labkit/src/loupe/lens/LensSlot.tsx:86-90) calls `update` on the same handle when `conditions` changes. When a cell goes from `conditions: null` to a comparison (or back), `update` sets `request = next` and `measure` posts under the new id (`lens-0~compared`), but nothing withdraws the request under the old id (`lens-0`). The trial keeps rendering a second, stale copy into the same `.fg-lens-live` target, and `detach` later removes only the new id, so the old copy outlives the lens. Should withdraw the previous cell id whenever it changes.
- evidence: read
- severity: medium

## A capture refuses state with an undefined entry that it accepts in config
- where: packages/forge/src/shell/loupe/capturePayload.ts:93 (capturePayload)
- scenario: config goes through `withoutUndefined` before `sendable`, so `{ a: undefined }` is sent as `{}`; state is checked raw, so `state = { a: undefined }` fails `survived` (key counts differ) and the lens says STATE_UNSENDABLE. The doc comment on `withoutUndefined` says a story reads undefined as unset either way, so the same shape is answered two ways. State should be stripped the same way (or neither should be).
- evidence: read
- severity: low

## A 503 from a capture leaves the source unavailable after captures work again
- where: packages/forge/src/shell/loupe/captureClient.ts:62 (take)
- scenario: `take` sets the status to the 503's reason, but a later successful `take` never sets it back to `true`, and the endpoint is re-polled only on `subscribe` or `attach`. Once the capture browser recovers, the status keeps reporting the old reason until a lens re-attaches or something subscribes again. A successful take should set the status to `true`, or a 503 should schedule a re-poll.
- evidence: read
- severity: low

## The Pixels source is built once from the first LoupeCaptureContext and ignores later values
- where: packages/forge/src/shell/loupe/usePixelsSource.ts:13 (usePixelsSource)
- scenario: `useState` reads `capture` only on the first render. If `LoupeProvider`'s `captureBase` starts out undefined and arrives later, no Pixels source ever exists. If `revision` is swapped for another `Revision`, the source keeps reading and subscribing to the old one, so story edits stop dropping stale captures. The effect below does depend on `capture`, but the source does not.
- evidence: read
- severity: low

## The compare menu groups rows by display label, so two globals sharing a label share one submenu
- where: packages/forge/src/shell/loupe/CompareMenu.tsx:79 (compareMenuDef)
- scenario: `groups` is keyed by `choice.group`, which is `declaration.label` for globals, 'DPR' and `Arg ${path}`. Two declared globals with the same label, or a global labeled "DPR", get their rows merged into one submenu, where "On"/"Light" rows from different globals can't be told apart. The group key should be the choice's identity (the global key, `dpr`, the arg path), with the label used only for display.
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

<!-- done: 5 findings, files read: 19 -->
