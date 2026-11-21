# Audit round 63 — labkit.lab.part2 (reviewer findings)

Note: commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not present in this clone (`git cat-file` reports a bad
object); the listed files were read at HEAD 6f634fabe1, where none of them has uncommitted changes.

## The fit warning names a box clipped inside an inner scroller as what makes the lab scroll
- where: packages/labkit/src/lab/fitCheck.ts:55 (candidates), :76 and :91 (explainLabScroll)
- scenario: `candidates()` yields every descendant from `querySelectorAll('*')` with its layout rect, including
  ones clipped by an inner `overflow: auto` container that sits well within the bound. Example: a trial's sidebar
  holds a 100-row scrolling list, and `.lk-shell-body` overflows by 6px because the footer is too tall. The last
  list row's rect reaches hundreds of px past the bound, so `findOvershoot` picks it, and the dev warning says
  "`div.lk-list-row` reaches 900px past it (y)". It should name the footer. The walk should skip the subtree of
  any descendant that clips its overflow (`overflow` not `visible`), or test that box's own edges and stop there.
  The page-scroll branch (line 91) has the same problem.
- evidence: read
- severity: low

## The fit warning names `.lk-shell-body` itself whenever it shows a classic scrollbar or a border
- where: packages/labkit/src/lab/fitCheck.ts:69-76 (explainLabScroll)
- scenario: the bound is `r.top + clientHeight` / `r.left + clientWidth`, which leaves out borders and scrollbars.
  The first candidate is the shell body's own border box (`r.bottom = r.top + offsetHeight`). With non-overlay
  scrollbars (Windows, Linux, or macOS set to "always show"), a body that scrolls on one axis shows a ~15px
  scrollbar on the other edge, so the root overshoots by about 15px. That beats any real culprit overshooting
  by less, and the warning reads "div.lk-shell-body reaches 15px past it". The bound should come from the
  padding box (`r.top + clientTop` … `+ clientHeight`), and the root should be left out of the candidates.
- evidence: read
- severity: low

## `Workspace` matches `ids` against children with falsy entries dropped, so tiles take the wrong ids
- where: packages/labkit/src/lab/Workspace.tsx:100,108 (Workspace)
- scenario: `items = Children.toArray(children)` drops `null`, `false` and `undefined` children, while `ids` is
  documented as "positionally matched" to the children. Given `ids={['a','b','c']}` and children
  `<A/>{showB && <B/>}<C/>` with `showB` false, the items are `[A, C]` and get ids `a` and `b`. C takes
  `b`'s persisted `layout` extent, `onReorder` reports `b` for it, and toggling `showB` back on moves C's node
  from `b` to `c`, which unregisters and re-registers it and drops its dragged extent. Either match ids before
  filtering, or say in `ids`' doc that only rendered children count.
- evidence: read
- severity: low

## A presented lab with `messages.origins` still posts its state to any origin
- where: packages/labkit/src/lab/presentationMessages.ts:135 (usePresentationMessages, `post`)
- scenario: `origins` restricts the origins whose commands the lab takes (line 138), but every `labkit:state`
  goes out with `postMessage(…, '*')`. An embed set up with `origins: ['https://docs.example']` and framed by
  some other site still reports its playing, time, duration and `messages.name` to that site, on presenting and
  on every play, pause, seek and end. With `origins` given, the state should go to each allowed origin (or to the
  host's origin only when it is one of them), not `'*'`.
- evidence: read
- severity: low

## The chord owner and the framed check read the global `document`/`window`, not the lab's own
- where: packages/labkit/src/lab/labChords.ts:49 (ownerNow); packages/labkit/src/lab/presentation.tsx:68 (isFramed)
- scenario: `useFocusPick` (useFocusPick.ts:23) and `usePresentationMessages` take the lab's document from
  `labBody.ownerDocument`, but `ownerNow` reads `document.activeElement` and `isFramed` reads the global
  `window`. A lab rendered through a portal into another document, such as a popped-out window or a same-origin
  iframe the app writes into, sends Mod+Z / Mod+S to the trial named by the opener's focus (falling back to
  `focusedTrialId`), not the trial focus is in. It also answers `framed` for the opener's window, so
  `lk-lab--framed` and the root reset in presentation.less go to the wrong document. The lab's document is
  answered two ways. Read `labBody?.ownerDocument` in both places.
- evidence: read
- severity: low

## Files read
packages/labkit/src/lab/TriallessPage.tsx
packages/labkit/src/lab/UnreadableRecords.tsx
packages/labkit/src/lab/Workspace.less
packages/labkit/src/lab/Workspace.stories.less
packages/labkit/src/lab/Workspace.stories.tsx
packages/labkit/src/lab/Workspace.tsx
packages/labkit/src/lab/fitCheck.ts
packages/labkit/src/lab/index.ts
packages/labkit/src/lab/keyClaims.ts
packages/labkit/src/lab/labAmbient.ts
packages/labkit/src/lab/labChords.ts
packages/labkit/src/lab/labChromeAll.ts
packages/labkit/src/lab/labContextMenus.ts
packages/labkit/src/lab/labMenus.ts
packages/labkit/src/lab/labModes.ts
packages/labkit/src/lab/labProps.ts
packages/labkit/src/lab/nebula.ts
packages/labkit/src/lab/openLab.ts
packages/labkit/src/lab/owningTrial.ts
packages/labkit/src/lab/panelHost.ts
packages/labkit/src/lab/presentation.less
packages/labkit/src/lab/presentation.tsx
packages/labkit/src/lab/presentationMessages.ts
packages/labkit/src/lab/snapshotCommands.ts
packages/labkit/src/lab/still.ts
packages/labkit/src/lab/storeCommands.ts
packages/labkit/src/lab/tileChrome.tsx
packages/labkit/src/lab/trialless.ts
packages/labkit/src/lab/useFocusPick.ts
packages/labkit/src/lab/workspaceStore.ts

<!-- done: 5 findings, files read: 30 -->
