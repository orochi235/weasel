# Audit round 75 — text-dom — blind reviewer findings

## A pasted table cell whose content sits in a block breaks the row into lines instead of tabs
- where: packages/text-dom/src/pasteRuns.ts:121-129 (htmlToRuns `boundary`, `visit` cell branch)
- scenario: paste `<table><tr><td><p>a</p></td><td><p>b</p></td></tr></table>` (Google Docs/Sheets, Word and most
  table editors wrap cell content in `<p>`/`<div>`). The second `<td>` sets `gap.tabs = 1`, then its `<p>` calls
  `boundary()`, which resets `tabs` to 0 and raises `gap.line` because the first cell's `<p>` left `onLine`/`gap.line`
  true. The row comes out `"a\nb"`; with the first cell's closing `</p>` alone it is `"a\n\tb"`. It should be
  `"a\tb"`, as the README promises ("its table cells are set apart by tabs") and as a browser's plain-text copy gives.
  A block's own boundary inside a cell must not turn the cell boundary into a line break or drop its tab.
- evidence: read
- severity: medium

## An edit open while its container is null loses everything typed when it commits
- where: packages/text-dom/src/useTextEdit.ts:58-66 (commit), packages/text-dom/src/overlayCarry.ts:33-46
- scenario: an edit is open, the host's `container` becomes `null` for a while (a remount, a panel collapsing), so the
  effect cleanup stashes the overlay's content and draft in `carryRef` and removes the overlay. Before a container
  returns, `commitEdit()` is called (a toolbar's Done button, a host's own blur/escape handling, a shortcut). `commit`
  finds `overlayRef.current === null`, returns `setEditingId(null)`, and the next effect's `takeCarry(null, false)`
  drops the carry. The typed text and the held node style are discarded with `onEnd` reporting a normal close; the
  carried fragment and draft should be committed (`draft.finished` can read a detached element).
- evidence: read
- severity: medium

## Starting an edit on another node while one is open discards the open edit's changes
- where: packages/text-dom/src/useTextEdit.ts:68-72 (startEdit), cleanup at 133-143
- scenario: `startEdit('a')`, type, then programmatic `startEdit('b')` (a host stepping to the next text node by Tab,
  or a double-click whose pointerdown landed on chrome that `isEditorChrome` exempts). `setEditingId('b')` reports
  `onEnd('a')`, the effect cleanup removes `a`'s overlay after `stopListening`, so no blur commit fires, and nothing
  calls `draft.finished`/`writeEdit` for `a`. `a`'s typing is silently dropped; `onEnd`'s doc lists "another edit
  opening over it" among the ways an edit closes, beside a commit, with no word that it cancels.
- evidence: read
- severity: low

## A run's `fontScale` (and in Chromium a numeric `fontSize`/`letterSpacing`) is rounded on every edit round trip
- where: packages/text-dom/src/domRuns.ts:192-196 (runsToDom), packages/text-dom/src/runStyle.ts:37,195-203
  (fontScalePercent / settle, styleStateFromElement)
- scenario: a run with `fontScale: 1/3` and no `fontSize` is written only as `font-size: 33.3333333333%` (12
  significant digits) and read back as `settle(33.3333333333 / 100) = 0.333333333333`, not `0.3333333333333333`.
  Any edit of the node then commits the altered scale (and `onInput` drafts carry it). The exact value is kept in
  `FONT_SCALE_ATTR` only when an absolute `fontSize` is also present. unruled.md (2026-11-10) rules that the overlay
  carries every key a run holds; writing `FONT_SCALE_ATTR` always would keep it. Inference, not run: Blink serializes
  inline CSS numbers to about 6 significant digits, so a world-unit `fontSize: 13.123456789` or `letterSpacing` read
  back from `span.style` loses precision the same way in Chrome, while the `{ px }` forms are kept in attributes.
- evidence: read (fontScale); inference (Chromium serialization of numeric lengths)
- severity: low

## Small caps' `capitalize` context skips overlay text that is not inside a run span
- where: packages/text-dom/src/domRuns.ts:281-305 (normalizeSmallCaps `visit`)
- scenario: `before` accumulates only `data-run` spans' text, and `visit` walks only `el.children`, so bare text
  nodes, `<br>`s and break stand-ins directly in the overlay (or in a non-run wrapper) are never added. With a
  small-caps, `textTransform: 'capitalize'` node whose overlay holds `"ab"` as a bare text node followed by a run span
  `"cd"` (a browser inserting outside the span, a plain-seeded overlay whose base later turns small-caps via
  `restyleNode`), the span is split as if `"cd"` opened a word: `c` is drawn as a full capital, while `runsToDom`,
  which counts every run's text in `before`, splits it as mid-word. The two walkers answer the same question two ways.
- evidence: read
- severity: low

## Test harness `makeRichHarness` reads its id-keyed table through the prototype chain
- where: packages/text-dom/src/testing/textEditHarness.ts:41-45 (makeRichHarness getText/getRuns/setText)
- scenario: an id of `'constructor'` or `'toString'` makes `data[id]?.text` read `Object.prototype`'s function, and
  `getRuns` returns `undefined` from it rather than treating the id as unknown; `makeHarness` beside it guards with
  `Object.hasOwn`, this one does not, so the two harnesses answer an unknown id differently.
- evidence: read
- severity: low

## Files read
packages/text-dom/src/armedStyle.ts
packages/text-dom/src/domOffsets.ts
packages/text-dom/src/domRuns.ts
packages/text-dom/src/editOverlay.ts
packages/text-dom/src/editSession.ts
packages/text-dom/src/heldNodeStyle.ts
packages/text-dom/src/index.ts
packages/text-dom/src/overlayBaseline.ts
packages/text-dom/src/overlayCarry.ts
packages/text-dom/src/overlayDirection.ts
packages/text-dom/src/overlayDraft.ts
packages/text-dom/src/overlayEdits.ts
packages/text-dom/src/overlayFollow.ts
packages/text-dom/src/overlayFrame.ts
packages/text-dom/src/overlayHistory.ts
packages/text-dom/src/overlayListeners.ts
packages/text-dom/src/overlayOpen.ts
packages/text-dom/src/overlayPlace.ts
packages/text-dom/src/overlayScroll.ts
packages/text-dom/src/overlaySeed.ts
packages/text-dom/src/overlaySelection.ts
packages/text-dom/src/overlayStyle.ts
packages/text-dom/src/overlayTyping.ts
packages/text-dom/src/pasteRuns.ts
packages/text-dom/src/pbt.fixture.ts
packages/text-dom/src/publishedRange.ts
packages/text-dom/src/runSplice.ts
packages/text-dom/src/runStyle.ts
packages/text-dom/src/selectionStyling.ts
packages/text-dom/src/styleShortcuts.ts
packages/text-dom/src/testing/baselineDrop.ts
packages/text-dom/src/testing/overlayDirection.ts
packages/text-dom/src/testing/overlayReady.ts
packages/text-dom/src/testing/textEditHarness.ts
packages/text-dom/src/textEditTypes.ts
packages/text-dom/src/useTextEdit.ts

<!-- done: 6 findings, files read: 36 -->
