# Audit round 65 — labkit.lab.part2

## `messages.origins: []` makes every state post throw
- where: packages/labkit/src/lab/presentationMessages.ts:131 (usePresentationMessages)
- scenario: `<Lab present messages={{ origins: [] }}>` (an embedder whose allow-list came out empty, meaning "trust no one"). `allowed` is `''`, which is not `undefined`, so `targets` is `['']`, and `post()` calls `host.postMessage(state, '')`. An empty targetOrigin fails URL parsing, and `postMessage` throws a `SyntaxError` DOMException from inside the effect. That takes the lab down through its error boundary. It should post nothing and take no messages.
- evidence: read (postMessage throws SyntaxError on a targetOrigin that is not `*`, `/` or a parsable URL)
- severity: medium

## `origins` is used as given when posting but compared as a literal string when receiving
- where: packages/labkit/src/lab/presentationMessages.ts:138,142 (usePresentationMessages)
- scenario: `messages={{ origins: ['https://host.example/'] }}`, or a page URL in place of a bare origin. `postMessage(state, 'https://host.example/')` normalizes the target to its origin, so the state reaches the host. But `targets.includes(event.origin)` compares against `'https://host.example'` with no trailing slash, so every command the host sends is dropped. The lab announces itself to the page and then ignores it. A `'*'` entry fails the same way: posting broadcasts, and receiving rejects everything. One normalization should serve both directions (e.g. `new URL(o).origin`).
- evidence: read
- severity: low

## The fit warning loses its culprit once `.lk-shell-body` has been scrolled
- where: packages/labkit/src/lab/fitCheck.ts:82-95 (explainLabScroll)
- scenario: The shell body overflows, and the user scrolls it to the bottom before a resize fires the check. `bound` is the shell body's padding box in viewport coordinates, but every descendant's `getBoundingClientRect()` has moved up by `scrollTop` (and left by `scrollLeft`). The element that overflows now ends at or above `bound.bottom`, `findOvershoot` finds nothing past the tolerance, and the one-time warning prints only `.lk-shell-body scrolls`, naming no culprit. The warning then stops itself, so it never names one. The bound should cover the scroll extent: add `scrollTop`/`scrollLeft` to the descendants' edges, or measure against `top - scrollTop`.
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

<!-- done: 3 findings, files read: 30 -->
