The findings file couldn't be saved: the first write worked, but the two later writes to `.skulk/out/findings.md` were refused permission. So the full document is below. Also, the checkout's HEAD is `d057251407`, not the frozen commit `7c016ebfdf`, and line numbers are from the tree as checked out.

# Findings: forge.frame (round 48)

## A shadow-DOM node in an a11y finding can never be highlighted: its selector chain is joined into one descendant selector
- where: packages/forge/src/frame/a11y.ts:60 (finding) with packages/forge/src/frame/a11yHighlight.ts:20 (resolveTarget)
- scenario: a story renders a custom element with an open shadow root holding an `<img>` without alt. axe reports `target: [["my-host", "img"]]`. `finding` flattens the inner array to the single string `"my-host img"`, and the A11y panel sends `targets: [["my-host img"]]` (shell/a11y/A11yPanel.tsx:93). `resolveTarget` then runs `document.querySelector("my-host img")`, which does not pierce the shadow root, so it returns null and no outline is drawn. `resolveTarget` already steps into `shadowRoot` per entry; the shadow parts should stay separate entries instead of being space-joined.
- evidence: read
- severity: medium

## An index page's frame ignores `a11y.highlight`, so the A11y panel can't outline anything on an index page
- where: packages/forge/src/frame/index/startIndex.tsx:86 (startIndex channel handler)
- scenario: `mountFrame` with an index id goes to `startIndex`. The A11y panel's `a11y.run` gets an answer, so findings are listed. Hovering a finding sends `a11y.highlight` (A11yPanel.tsx:93), which falls into `default: break`, so no outline is drawn. `startFrame` creates an `A11yHighlighter` for the same message, so the two frame kinds answer one protocol two ways. `startIndex` should create and dispose a highlighter too.
- evidence: read
- severity: medium

## An index page's frame never reports or applies its document scroll, so loupe copies and captures of a scrolled index page show its top
- where: packages/forge/src/frame/index/startIndex.tsx:46 (startIndex), compared with packages/forge/src/frame/FrameController.tsx:79
- scenario: an index page is a fullscreen frame document taller than the trial, so the reader scrolls the frame document itself. `startFrame` calls `followDocumentScroll`, so the shell gets `scroll` (shell/frameLink.ts:178 `reportFrameScroll`) and can send `scroll` back to copies. `startIndex` does neither: it never reports a scroll, and it drops an incoming `scroll`. A loupe's live copy, and a capture taken from the screen's scroll, stay at scroll 0 while the trial is scrolled down. It should call `followDocumentScroll(document, send)` and dispose it, as `startFrame` does.
- evidence: read
- severity: medium

## Overriding a token reports a stale value for every token defined through it
- where: packages/forge/src/frame/cssVarsWatch.ts:53 (revise), called from packages/forge/src/frame/FrameController.tsx:99
- scenario: the theme declares `--wzl-accent: #36f` and `--wzl-focus: var(--wzl-accent)`, and the shell sends `vars.set --wzl-accent red`. `revise` re-resolves only `--wzl-accent`. The computed `--wzl-focus` is now `red` too, but the report still says `#36f`. `ownMutation` skips the override's own mutation, so no later scan corrects it until something unrelated mutates the DOM. It should rescan, or re-resolve every reported name.
- evidence: read
- severity: low

## On a frame with an iframe, a highlight box is placed in the wrong spot and doesn't follow the inner document's scroll
- where: packages/forge/src/frame/a11yHighlight.ts:42 (place) with resolveTarget at :31
- scenario: a story embeds a same-origin `<iframe>`, and axe reports a node inside it as `target: ["iframe", "#btn"]`. `resolveTarget` steps into `contentDocument` and returns the inner element. `place` takes that element's `getBoundingClientRect()`, which is relative to the iframe's viewport, and writes it to a `position: fixed` box in the outer document, so the outline is off by the iframe's offset. Scroll and resize are only listened to on the outer `view`, so scrolling inside the iframe leaves the box behind. The fix is to add each iframe's own rect at each step and also listen to the inner view's scroll.
- evidence: read
- severity: low

## Files read
packages/forge/src/frame/FrameController.tsx
packages/forge/src/frame/StoryHost.tsx
packages/forge/src/frame/a11y.ts
packages/forge/src/frame/a11yContrast.ts
packages/forge/src/frame/a11yHighlight.ts
packages/forge/src/frame/capture/CaptureView.tsx
packages/forge/src/frame/capture/capture.css
packages/forge/src/frame/capture/mountCapture.tsx
packages/forge/src/frame/cssVarUse.ts
packages/forge/src/frame/cssVars.ts
packages/forge/src/frame/cssVarsWatch.ts
packages/forge/src/frame/documentScroll.ts
packages/forge/src/frame/fault.ts
packages/forge/src/frame/frame.css
packages/forge/src/frame/frameDecorators.tsx
packages/forge/src/frame/globalsTarget.ts
packages/forge/src/frame/index.ts
packages/forge/src/frame/index/Description.tsx
packages/forge/src/frame/index/IndexApi.tsx
packages/forge/src/frame/index/IndexPage.tsx
packages/forge/src/frame/index/LabBadge.tsx
packages/forge/src/frame/index/LibraryBadge.tsx
packages/forge/src/frame/index/TypeText.tsx
packages/forge/src/frame/index/api.css
packages/forge/src/frame/index/envContext.ts
packages/forge/src/frame/index/index.css
packages/forge/src/frame/index/indexEnv.ts
packages/forge/src/frame/index/startIndex.tsx
packages/forge/src/frame/index/useFullscreenFit.ts
packages/forge/src/frame/index/variants.ts
packages/forge/src/frame/mountFrame.tsx
packages/forge/src/frame/safeOverride.ts
packages/forge/src/frame/storySession.tsx

<!-- done: 5 findings, files read: 33 -->