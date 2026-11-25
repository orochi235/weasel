- normalizeSmallCaps loses a block's line feed when it rewrites a run span (A): fixed c98934ee2a. The text ahead of later runs, which decides where `capitalize` starts a word, was missing the same line feed; that commit fixes it too.
- The overlay's `::selection` rule misses the run spans holding its text (A): fixed 60e24eec0d
- A rotated or skewed clipping node measures the CSS baseline wrong and caches the wrong value (B): fixed e2ed4f70a4. The probe now solves the ancestor's whole transform from three pinned points instead of dividing by the rect's width.
- A null pose hides the focused overlay with `display: none`, which drops focus (B): fixed 71da032c24. The overlay is now hidden by clipping its clip box to zero size, so it stays rendered and focused.
- The italic docs contradict the code, and the two paths store different shapes (B): fixed b003064de8, docs only. The stored-shape half is not a defect: for italic, `setFlagOverRange` writes `italic: false` over the range and leaves the node style alone (`flagRange.ts:90`), so both paths store the same shape. `useTextEdit.uprightItalic.test.ts` covers both paths.

Checks:
- `npx vitest run --maxWorkers=1`, one at a time: domRuns.smcpBlock pass (2), domRuns.smcp and domRuns pass (88 together), overlayOpen pass (4), overlayBaseline pass (2), overlayPlace pass (2), useTextEdit.uprightItalic pass (7). Also useTextEdit.overlayStyle, .lifecycle, .overlayGeometry, .overlayScroll, .session and .container: all pass.
- `overlayFocus.browser.test.ts` (a new case for keeping focus with no pose): unrun, it needs a browser.
- `npm run checks:gate`: pass, "all 33 passed".
- `npm run check:changesets`: pass, "OK — 824 changeset(s)".
- `npm run lint -w @weasel-js/text-dom`: did not run, because the package has no `lint` script. eslint on every file I changed: pass.
- Tree is clean apart from `.skulkr/`.

tally: 5 of 5 fixed, 0 extra fixed