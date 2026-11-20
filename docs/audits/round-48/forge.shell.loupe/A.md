# Findings: forge.shell.loupe (round 48)

## A Difference lens's captures stay in the shared shot map for the workshop's life after the lens closes
- where: packages/forge/src/shell/loupe/pixelsSource.ts:84 (createPixelsSource → capture)
- scenario: `capture()` (used by Difference, which never attaches) stores its base and compared bitmaps in `shared.shots` under `sideOf(request)` (`<lensId>:<dpr>[:compared]`). Only `attachPixelsLens`'s `detach` deletes a side, and `revised()` clears the map only while some lens is attached (`unrevise` is subscribed in `attach` and dropped when the last attached lens detaches). Open and close Difference lenses (each a new lens id), or switch a Difference lens's DPR, with no attached Pixels lens: every side's ImageBitmap (box × dpr² px, several MB at 3×) stays in the map, never closed, and even a story edit does not drop them. Should delete or close a side's shot when nothing reads it any more (or bound the map), as the attached path does.
- evidence: read
- severity: medium

## A replaced or cleared Pixels shot's ImageBitmap is never closed
- where: packages/forge/src/shell/loupe/pixelsLens.ts:116 (attachPixelsLens → run), pixelsSource.ts:38 (revised), pixelsSource.ts:85, pixelsLens.ts:179 (detach)
- scenario: each new capture for a side does `shared.shots.set(side, …)` over the previous shot without `bitmap.close()`; `revised()` does `shots.clear()` and `detach` does `shots.delete()` the same way. Moving the reticle across a story with a Pixels lens open takes a capture per rest, each orphaning the last bitmap to the collector, while the code's own rule (line 114, "A capture nothing will show is let go of now rather than left to the collector") closes discarded bitmaps eagerly. Two answers to the same question; the replaced/cleared ones hold GPU-backed memory until GC.
- evidence: read
- severity: low

## The Contrast readout over Pixels posts a capture on every reticle move, bypassing the lens's rest delay
- where: packages/forge/src/shell/loupe/readouts.tsx:147 (ContrastReadout, Pixels effect)
- scenario: the effect re-runs on every `reticle.x`/`reticle.y` change and schedules `source.capture(request)` with `setTimeout(…, 0)`; `capture` (pixelsSource.ts:67) POSTs to the capture endpoint whenever the side's shot is not fresh for the new key, with no rest wait and no in-flight dedupe. Drag a Follow lens with the Contrast readout on over a story: each pointer move (one per frame, longer than 0 ms, so the cleanup's `clearTimeout` never catches it) sends a headless-Chromium capture, while the attached Pixels lens itself waits `LENS_REST_MS` at rest before asking. Cancelling the effect only drops the answer, not the request. Should wait the same rest (or reuse the lens's pending capture) before capturing.
- evidence: read
- severity: medium

## A Split lens's Live Token/Contrast readout finds nothing once the seam is dragged right of center
- where: packages/forge/src/shell/loupe/readouts.tsx:100 (comparedAim), readouts.tsx:117 (liveAim)
- scenario: with a comparison, the readout reads the `~compared` copy at the interior's center. In Split the compared side is clipped to `inset(0 0 0 var(--lk-lens-seam))` (labkit Lens.less:98), and a clipped-out region takes no hit test, so `topmostIn` → `elementsFromPoint` at the center returns only the base copy's elements, which `within.contains` rejects. Drag the seam to 0.7: the readout shows "No color under the aim" / "No text under the aim" although the compared copy has text at the reticle. Should aim at a point inside the compared side's visible part (or not hit-test through the clip).
- evidence: read
- severity: medium

## A Live copy keeps its host's old size when the host resizes without the reticle's local point moving
- where: packages/forge/src/shell/loupe/liveSource.ts:24 (sameRequest), LiveCopies.tsx:64 (placement)
- scenario: `placement` sizes the copy from `hit.host.offsetWidth/offsetHeight` at render, but `sameRequest` compares only the host element, the local point, scale, factor, slot size, args, compare and context. Widen or narrow a story's pane from its right edge (or resize the window with the story anchored top-left) with a Live lens over it: `remeasure` builds an identical request, `post` skips it, nothing re-renders `LensCopy`, and the copy goes on laying out at the old width, so text wraps differently from the main story it claims to magnify. The host's size should be part of the request's identity.
- evidence: read
- severity: medium

## The Contrast readout's Pixels reading stays on the old DPR after the lens's DPR changes
- where: packages/forge/src/shell/loupe/readouts.tsx:168 (ContrastReadout effect deps)
- scenario: the effect builds its request from `latest.current.settings` via `requestsOf`, which reads `settings.dprs`, but its deps are only the reticle, `settings.factor`, `settings.compare` and `tick`. Pick DPR 3× on a Pixels lens with the Contrast readout on: the cell remounts and captures at 3×, but neither the deps nor the source's emitter change (`attach` and a lens's own capture emit nothing), so the readout keeps showing the 1× reading until the reticle moves. `settings.dprs` (and `settings.source`) belong in the deps.
- evidence: read
- severity: low

## The compare menu gives two options the same variant key when their values stringify alike
- where: packages/forge/src/shell/loupe/CompareMenu.tsx:45 (argChoices), CompareMenu.tsx:59 (compareChoices)
- scenario: the row key is `arg.${path}.${String(o.value)}` (and `global.${key}.${o.value}`). An arg whose options are objects (`{ value: { w: 1 }, label: 'Small' }`, `{ value: { w: 2 }, label: 'Large' }`) gives both rows `arg.size.[object Object]`; the same goes for a path and value whose dots line up (`a` with value `'b.c'` vs `a.b` with value `'c'`). The two rows resolve to one action variant, so picking "Large" applies whichever variant the registry finds first. Keys should be unique per row (an index, or a stable encoding of the value).
- evidence: read
- severity: low

## tokenChain drops declarations that follow a nested rule inside a style rule
- where: packages/forge/src/shell/loupe/tokenChain.ts:119 (collect)
- scenario: in current Chromium, declarations written after a nested rule (`.card { .title { … } color: var(--wzl-fg); }`) are a `CSSNestedDeclarations` child (rule type 0, no `cssRules`). `collect` skips any non-style rule without children, so that `color` is never indexed: the Token readout reports the chain from a less specific rule or an ancestor (or an empty one), not the declaration that actually wins. Such a child's `style` should be indexed under its parent's selector.
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

<!-- done: 8 findings, files read: 19 -->
