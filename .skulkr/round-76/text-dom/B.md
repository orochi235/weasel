# Audit round 76, text-dom, blind reviewer

## A turned clipping node measures the CSS baseline wrong, and caches the wrong value for every later edit in that face
- where: packages/text-dom/src/overlayBaseline.ts:33 (cssBaseline), called from packages/text-dom/src/overlayPlace.ts:189 (placeScrolled)
- scenario: placeScrolled sets the scroll box's `transform` to the pose's frame (rotation/skew) *before* calling `baselineDrop`, and `cssBaseline` appends its probe line to `el.parentElement`, which is that scroll box. The probe divides by `box.width / 100` on the premise that the rect "undoes any transform on an ancestor". That only holds for a scale. Under a rotation the bounding rect is an axis-aligned hull. Take a 30° frame, line height L=20 and a true baseline B=15. The rect width is (86.6 + 0.5·L)·z, so the scale reads 0.966·z, and the mark's top sits 0.866·B·z below the hull's top. The result is a baseline of ≈13.45 instead of 15. At 90° the result is 0, so `baselineDrop` returns 0 and the overlay is set with no correction at all. Any positive wrong value is stored in the module-wide `CSS_BASELINES` under a key built only from font properties. From then on every edit in that face and size gets the wrong drop, including unturned and loose-placed ones, until 64 other keys clear the cache. The overlay then sits about 1–2 px off the canvas's baseline. It should measure in an untransformed parent (for example the clip box or the container), or skip caching when an ancestor transform is not a pure scale.
- evidence: read (overlayPlace.ts sets `transform: overlayTransform(pose, …)` on `box` at line 172, before line 189's `baselineDrop`; the arithmetic above is inference)
- severity: medium

## A node whose pose goes null mid-edit hides the focused overlay with `display: none`, which drops focus, so the edit is orphaned
- where: packages/text-dom/src/overlayPlace.ts:66 (placeOverlay)
- scenario: `getScreenPose` returns null for one or more frames during an edit, for example when the node is culled or scrolled out of the view. `placeOverlay` sets `el.style.display = 'none'` on the overlay, which holds focus. The comment there says the box keeps its scroll "for when the node comes back", so the edit is meant to survive. But an element that is not rendered cannot keep focus: the focus fixup rule moves focus to `body`, and the DOM selection leaves the overlay. When the pose returns, `display` goes back to `''` and nothing refocuses the overlay or restores the caret. Keystrokes in the meantime go to the page, so canvas shortcuts fire and the text gets none of them. If the engine fires `blur` on the fixup (relatedTarget null, document still focused), `onBlur` commits and ends the edit outright. It should hide with `visibility: hidden` / `opacity: 0`, which keeps focus, or refocus and reselect `selectionRef` when the pose comes back.
- evidence: inference (read the code path; the browser focus behavior is from the HTML focus-fixup rule, not run here)
- severity: medium

## The docs say a run cannot say "not italic" and that the toggle is declined without `setStyle`, while the code writes `italic: false` on runs
- where: packages/text-dom/src/textEditTypes.ts:118 (UseTextEditOptions.setStyle) and :284 (applyStyleToSelection); packages/text-dom/src/selectionStyling.ts:83 (applyStyle)
- scenario: in an italic node, select a range and toggle italic off. `patchForToggle` returns `{ italic: false }`. With `setStyle` or `onChange` given, `applyStyle` treats `italic` as an unset node flag: it rewrites the node style through `setFlagOverRange` and raises italic on the runs outside the range. Without either, `unsetFlag` is undefined and the same patch goes through `applyStyleToRange`, storing `italic: false` on the selected runs. That works, since `armedStyle.ts` and `patchForToggle` both treat a run's `italic: false` as upright under italic text. So one decision is answered two different ways, giving different stored shapes (a node rewrite plus raised runs, or a run override) depending only on whether a setter exists. The public docs, meanwhile, say "a run cannot say 'not italic'" and "Without this or `onChange`, such a toggle is declined and nothing changes", and neither holds for italic. Either italic should take the run override on both paths, or the docs should say italic is the exception.
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

<!-- done: 3 findings, files read: 36 -->
