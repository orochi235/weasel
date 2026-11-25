I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole findings document is below.

## Shadow-DOM a11y findings can never be highlighted: `finding()` flattens the shadow path that `resolveTarget` needs split
- where: packages/forge/src/frame/a11y.ts:60 (finding), packages/forge/src/frame/a11yHighlight.ts:20 (resolveTarget)
- scenario: A story renders an element with an accessibility violation inside an open shadow root. axe reports `target: [["#outer", "#inner"]]`: one entry, holding an array for the shadow path. `finding()` joins that into `['#outer #inner']`. When the A11y panel points at the node, the shell sends `a11y.highlight` with this target. `resolveTarget` then runs `document.querySelector('#outer #inner')`, which can't cross a shadow boundary, so it returns null and no outline is drawn. `resolveTarget` already handles a shadow path given as separate entries (its own test passes `['#outer', '#inner']`), so the two halves disagree on the target's format.
- evidence: read
- severity: medium

## An index page in a frame ignores `a11y.highlight`, `scroll` and `vars.set`, which a story frame handles
- where: packages/forge/src/frame/index/startIndex.tsx:86 (startIndex channel handler)
- scenario: Open a component's index page isolated in a frame and run the A11y panel. Hovering a node sends `a11y.highlight` (A11yPanel.tsx:93), but `startIndex` handles only `init`, `globals` and `a11y.run`, so nothing is outlined. The index frame also never calls `followDocumentScroll`. It doesn't report its scroll position, and it ignores the shell's `scroll` message (FrameView.tsx:194), so a lens copy or a capture of an index page doesn't land on the scrolled area. `startFrame` wires up all three (FrameController.tsx:79, 105, 108); the index path silently drops them.
- evidence: read
- severity: medium

## A throw from `applyGlobals` on an index page escapes the channel handler, and the trial never hears back
- where: packages/forge/src/frame/index/startIndex.tsx:91 (startIndex, 'init'/'globals' case)
- scenario: A frame config's `applyGlobals` throws, for example on an unknown theme mode. In a story frame, `createStorySession.input` catches the throw and sends `fault('render', …, seq)` (storySession.tsx:100). In `startIndex` the call runs unguarded: the exception escapes the channel listener, no `fault` or `rendered` message is sent, and the shell waits on a frame that never answers. The same decision ("an input that throws faults the frame") is answered two ways.
- evidence: read
- severity: medium

## Overriding a CSS var leaves every var derived from it stale in the vars report
- where: packages/forge/src/frame/cssVarsWatch.ts:53 (revise), packages/forge/src/frame/FrameController.tsx:97
- scenario: A theme declares `--wzl-button-bg: var(--wzl-accent)`, and the shell sets an override on `--wzl-accent`. `vars.set` writes the override and calls `revise('--wzl-accent')`, which re-resolves only that one name. `ownMutation` filters out the override's own style mutation, so no rescan follows. The report keeps `--wzl-button-bg` at its old computed value until some unrelated DOM mutation triggers a full scan.
- evidence: read
- severity: low

## An index page's fault drops the stack that story faults carry
- where: packages/forge/src/frame/index/startIndex.tsx:68 (PageBoundary onError)
- scenario: An index page's own `render` throws. `startIndex` builds `{ type: 'fault', phase: 'render', message }` inline, while every other fault goes through `fault()` (fault.ts), which also attaches `error.stack`. So the shell shows a stack when a story throws, but none when an index page throws.
- evidence: read
- severity: low

## The a11y highlight box is misplaced for a target inside an iframe
- where: packages/forge/src/frame/a11yHighlight.ts:30 (resolveTarget), :44 (place)
- scenario: A story embeds a same-origin iframe, and axe reports a node inside it (`['iframe', '#inner']`). `resolveTarget` steps into the iframe's `contentDocument` and returns the inner element. `place()` then positions a `position: fixed` box in the outer document from `el.getBoundingClientRect()`, which is measured from the iframe's own viewport. The outline lands offset by the iframe's position, and it doesn't follow scrolling inside the iframe, because the scroll listener is on the outer window only.
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

<!-- done: 6 findings, files read: 33 -->