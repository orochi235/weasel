# Findings: forge.shell.loupe (round 48, blind reviewer)

## A replaced or dropped Pixels shot's ImageBitmap is never closed
- where: packages/forge/src/shell/loupe/pixelsLens.ts:116 (attachPixelsLens `run`), :179 (`detach`); packages/forge/src/shell/loupe/pixelsSource.ts:38 (`revised`), :85 (`capture`)
- scenario: a Pixels lens sits over a story while the reticle moves or the story is edited. Each new capture `shared.shots.set(side, …)` overwrites the side's previous `Shot` without `bitmap.close()`; `revised()` clears the whole map, and `detach()` deletes the side's entry, both without closing. Every capture's decoded bitmap (box × DPR² pixels, up to 3× DPR) stays alive until GC finds it. The same file closes a capture nothing will show "rather than left to the collector" (line 114–115), so the module answers "who frees a bitmap" two ways: discarded-in-flight ones are closed, superseded and detached ones leak to the collector. Should close the old shot's bitmap on overwrite, clear, and detach.
- evidence: read
- severity: medium

## A 503 from the capture endpoint with a non-JSON body rejects `take` instead of answering null
- where: packages/forge/src/shell/loupe/captureClient.ts:56–58 (`take`)
- scenario: a proxy or the dev server returns 503 with an HTML/plain body (e.g. Vite restarting, a reverse proxy's "Service Unavailable"). `await res.json()` throws, so `take` rejects and the lens shows "Capture failed: Unexpected token <…" instead of the documented contract ("null when the endpoint answers that it cannot take one") and the status never moves to unavailable. The `!res.ok` branch right below guards the same parse with `.catch(() => ({}))`; the 503 branch does not.
- evidence: read
- severity: low

## The Pixels Contrast readout posts a capture on every reticle move, with no rest delay
- where: packages/forge/src/shell/loupe/readouts.tsx:147–168 (ContrastReadout, the Pixels effect)
- scenario: a Pixels lens with the Contrast readout on, reticle dragged across a story. The effect re-runs on every `reticle.x/y` change and starts `setTimeout(…, 0)`; a 0 ms timer fires before the next pointer frame, so each frame's position calls `source.capture(request)`, which (key not fresh) POSTs a full headless-Chromium capture to the dev server. A 1-second drag queues ~60 captures, each decoded into an ImageBitmap stored over the last in `shared.shots`. The lens cell beside it (pixelsLens.ts `schedule`) and the Difference view (labkit `useCaptureDelay`) both capture at once the first time and after `LENS_REST_MS` at rest afterward; the readout answers the same "when to capture" question a third, unthrottled way.
- evidence: read
- severity: medium

## Live and Pixels lenses never re-resolve when the OS color scheme flips
- where: packages/forge/src/shell/loupe/ForgeLoupe.tsx:52–100 (ForgeLoupe; nothing subscribes), packages/forge/src/shell/loupe/conditions.ts:128–131 (`resolveContextOf` reads `systemColorScheme()` once per measure)
- scenario: lab mode `auto`, a lens set to Opposite mode over a story shown light. The OS switches to dark: the story re-renders dark, but nothing remeasures the lens sources — `useLensRemeasure` re-runs on trials, lab `mode` (still `'auto'`) and `labValues`, none of which change, and no `watchColorScheme` subscription exists anywhere in the loupe. The Live request keeps `ctx.prefersDark = false`, so `resolveComparison` still flips to `dark`, and the lens now shows the same mode as the story under it while its label still says "Opposite mode". A Pixels lens's payload `colorScheme`/`lab.mode` stay `light` the same way. It corrects only when the reticle moves or a trial changes.
- evidence: read
- severity: medium

## Compare-menu variant keys collide for arg options whose values stringify alike
- where: packages/forge/src/shell/loupe/CompareMenu.tsx:45 (argChoices `key: \`arg.${path}.${String(o.value)}\``), :59 (`global.${key}.${o.value}`)
- scenario: a story arg with options whose values are objects (`[{value:{w:1}},{value:{w:2}}]` → both `arg.size.[object Object]`), or `1` and `'1'`, or dotted names (`global a.b` option `c` vs `global a` option `b.c` → both `global.a.b.c`). The two rows get one variant key, so `compareMenuDef` emits two refs to the same `loupe.compare.with:<key>` and picking either applies whichever variant the registry resolves first: one of the options can never be compared against. Keys should be indexed or encoded, not built from `String(value)`.
- evidence: read
- severity: low

## Token chain cache ignores changes to the element's or ancestors' attributes and inline style
- where: packages/forge/src/shell/loupe/tokenChain.ts:248–257 (`tokenChain` cache key), :220–229 (`revisions` observes `doc.head` only)
- scenario: the key is computed value + head-mutation count + sheet counts. A story toggles a class or `data-theme` on an ancestor (or edits an inline `style`, or rewrites a `<style>` element in the body) so a different rule/token now supplies the same computed color, e.g. `--wzl-accent` and `--wzl-link` both resolving to the same blue. The key is unchanged, so the Token readout keeps naming the old selector and token chain for that element; it never re-walks until the color value or the head changes.
- evidence: read
- severity: low

## A Live copy keeps its host's old size after the host resizes under a still reticle
- where: packages/forge/src/shell/loupe/liveSource.ts:24–40 (`sameRequest`), packages/forge/src/shell/loupe/LiveCopies.tsx:64–73 (`placement`)
- scenario: a story in a layout that fills its pane, a Live lens parked near the host's top-left corner, then the window (or a side panel) is resized so the host's width changes but its left/top and the reticle's local point do not. `useLensRemeasure` remeasures on resize, but `sameRequest` compares host identity, local point, scale, factor and slot size, never the host's own size, so nothing is posted and `LensCopy` does not re-render. `placement` read `hit.host.offsetWidth/Height` when it last rendered, so the copy keeps laying the story out at the old width: text wraps and flex rows break differently from the story under the reticle, and the lens shows a layout that no longer exists. Pixels does not have this problem because `box` is in its payload key.
- evidence: read
- severity: low

## The Pixels Contrast reading is not retaken when the lens's size or DPRs change
- where: packages/forge/src/shell/loupe/readouts.tsx:168 (ContrastReadout effect deps)
- scenario: the effect builds its request from `latest.current` (lens, settings, reticle, size) but re-runs only on reticle, `settings.factor`, `settings.compare`, `tick` and `source`. Changing the lens's DPRs (the request's `dpr`, so a different capture side and resolution) or resizing the lens with the reticle still leaves the previous reading up. `tick` does not cover it: re-attaching the cell calls `client.poll()`, which emits only if the status changes. The reading shown is from a capture at the old DPR until the reticle moves.
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
