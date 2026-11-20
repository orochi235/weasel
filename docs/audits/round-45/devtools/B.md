# Audit round 45: devtools

Read from the working tree; the checkout's HEAD is 782733b19c, not the 04c3a65 the brief names (git commands needed approval here, so I did not diff the two).

## Two clients on one in-page transport get each other's replies, and one panel's `bye` ends the other's session
- where: packages/devtools/src/inPageTransport.ts:14 (createInPagePanelTransport `send`), packages/devtools/src/client.ts:68,105 (createDevtoolsClient `nextId`, `result` case)
- scenario: one `createInPagePanelTransport()` handed to two `<DevtoolsPanel>`s, or to a panel plus a `connectDevtools` script. Every client numbers its requests from 1. The pair transport sends every page message to every panel listener, so client B's pending request 1 resolves with the reply to client A's request 1, and the view renders the other request's data (a `get-state` answer shown as `get-children`, and so on). Also, B's `yo` closes A's session (`close?.()`), and when A unmounts its `bye` closes the only session, so B stops getting answers and still shows `connected`. Each client should have its own session, or the transport should refuse a second one out loud.
- evidence: read (pair() in page/transport.ts emits to all subscribers; hook.connect serves one session per call)
- severity: medium

## `close()` and `open()` leave the client broken when the transport's `send` throws, though `request()` handles that case
- where: packages/devtools/src/client.ts:139-154 (open, close)
- scenario: a transport whose `send` throws, such as an extension port that has already disconnected. In `close()`, the throw from sending `bye` comes before `off()`, so the listener stays subscribed, the status never becomes `closed`, and pending requests are never rejected. In `open()`, `off` is set before the `yo` send throws, so the status stays `connecting` for good and every later `open()` returns early at `if (off) return`, which blocks any retry. `request()` catches the same throw and cleans up. Either both paths should handle a failing send, or neither should.
- evidence: read
- severity: low

## The panel's body says "Connecting…" after the connection has failed
- where: packages/devtools/src/DevtoolsPanel.tsx:60
- scenario: the page answers `yo` with an `error` that has `requestId: null` (a protocol mismatch). The client's status becomes `error` and the roots stay `[]`. The bar shows the error message, but the body checks only for `connected`, so it shows "Connecting…" forever, as if an answer were still coming.
- evidence: read
- severity: low

## Turning coords off and back on during a read loses the restart from the oldest record
- where: packages/devtools/src/trace.ts:34-36,47-50 (followTrace readOnce, setCoords)
- scenario: DispatchView polls `read()`. While a read sent with `coordCursor: N` is in flight, the user unticks coords (DispatchView clears its list) and ticks it again (`setCoords(true)` sets `coordCursor = 0`, which promises a restart from the oldest record). The reply then overwrites `coordCursor` with the old continuing cursor and returns only the coords after N. The view gets a partial list, and the oldest records are never read again. readOnce should keep the reply's coords only if `coordCursor` still has the value the request was sent with.
- evidence: read (DispatchView.tsx:49,62-64 is the caller)
- severity: low

## Files read
packages/devtools/src/DevtoolsPanel.browser.module.css
packages/devtools/src/DevtoolsPanel.module.css
packages/devtools/src/DevtoolsPanel.stories.module.css
packages/devtools/src/DevtoolsPanel.stories.tsx
packages/devtools/src/DevtoolsPanel.tsx
packages/devtools/src/RootPicker.tsx
packages/devtools/src/client.ts
packages/devtools/src/history.ts
packages/devtools/src/hook.ts
packages/devtools/src/hooks.ts
packages/devtools/src/icons.gen.ts
packages/devtools/src/inPageTransport.ts
packages/devtools/src/index.ts
packages/devtools/src/mount.tsx
packages/devtools/src/protocol.ts
packages/devtools/src/tabs.ts
packages/devtools/src/testing/mountCanvas.tsx
packages/devtools/src/trace.ts

<!-- done: 4 findings, files read: 18 -->
