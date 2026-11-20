I couldn't write `.skulk/out/findings.md` because permission was denied, so the full document follows. The frozen commit 04c3a65 isn't in this clone. I read HEAD 782733b19c instead, which has no changes under `packages/devtools`.

# Audit round 45: devtools findings

## A window-transport client resolves its pending requests with another panel's results, and hangs once its session is replaced
- where: packages/devtools/src/client.ts:105 (createDevtoolsClient, `receive` 'result' / 'error' cases)
- scenario: two `DevtoolsPanel`s on one page, each over `createWindowPanelTransport()`.
  - Both clients number their requests from 1.
  - `serveWindow` keeps only one session and closes the earlier one when the second `yo` arrives (page/hook.ts:78).
  - Every page message is posted to the window, so both clients hear all of them. B's `result` for requestId 1 resolves A's pending request 1 with B's data, and B's `sup` overwrites A's roots.
  - A's requests after its session closed are never answered (page/session.ts:90) and never rejected, so they stay pending forever while A still shows `connected`.
  - Should: match results to the session that asked, and tell a client when its session has been replaced.
- evidence: read
- severity: medium

## `close()` leaves the client half-open when sending `bye` throws
- where: packages/devtools/src/client.ts:145 (createDevtoolsClient, `close`)
- scenario: a transport whose `send` throws after the other end goes away, such as an extension `runtime.Port` after the inspected page navigates.
  - `transport.send(bye)` throws before `off()` runs, so the transport listener leaks.
  - Status never becomes `closed` and pending requests are never rejected.
  - The throw surfaces from `useDevtoolsClient`'s effect cleanup.
  - A later `open()` returns early because `off` is still set, so the client can never reconnect.
  - `request()` already wraps its `send` in a try/catch; `close()` should tear down whether or not `bye` went out.
- evidence: read
- severity: low

## Turning coord records off and back on while a read is in flight loses the restart from the oldest record
- where: packages/devtools/src/trace.ts:34 (followTrace, `readOnce`)
- scenario: coords are on with `coordCursor` = 40, and a read asking for `coordCursor: 40` is in flight.
  - Before it answers, `setCoords(false)` then `setCoords(true)` sets `coordCursor = 0`, as documented.
  - The in-flight answer then sees `coordCursor !== null`, overwrites it with its own cursor (40 or more), and returns records from 40 on.
  - Records 0–39 never reach the reader that just restarted.
  - The check should compare against the cursor captured when the request was sent.
- evidence: read
- severity: low

## A protocol-mismatch error shows "Connecting…" in the panel body forever
- where: packages/devtools/src/DevtoolsPanel.tsx:60 (DevtoolsPanel)
- scenario: the page speaks another protocol version.
  - It answers `yo` with an `error` whose `requestId` is null, and the client goes to `status: 'error'` with no roots.
  - The status line shows the mismatch message.
  - The body's empty state falls through to 'Connecting…' and stays there, though nothing is connecting.
- evidence: read
- severity: low

## `tabs={[]}` renders an empty tab bar with a selected key that names no tab
- where: packages/devtools/src/DevtoolsPanel.tsx:31 (DevtoolsPanel)
- scenario: a caller passes `tabs={[]}`.
  - `shown` is `[]` and the selected tab falls back to `'scene'`.
  - The single-tab branch doesn't apply, so `<Tabs selectedKey="scene">` renders with no tabs and no panels.
  - The result is an empty tab strip and a blank body.
  - The prop's doc covers one tab but not zero.
- evidence: read
- severity: low

## The story asks for a `rect` tool core does not have
- where: packages/devtools/src/DevtoolsPanel.stories.tsx:20 (Board)
- scenario: the story passes `tools={{ hand: true, rect: true }}`.
  - Core's only built-in tool id is `'hand'` (core/src/canvas/SceneCanvas/builtinToolSets.ts:5).
  - The `tools` prop's own doc says an unknown built-in id given `true` warns in dev and is ignored.
  - So the story logs a dev warning on every mount and offers no way to draw a node.
  - The rect tool lives in `@weasel-js/editing` and needs that package's preset or `useRectTool`.
- evidence: read
- severity: low

## The story's canvas has no editing selection, so the panel's Select steering does nothing there
- where: packages/devtools/src/DevtoolsPanel.stories.tsx:20 (Board)
- scenario: the panel's Select button writes the canvas's selection.
  - testing/mountCanvas.tsx:8 says only an editing selection accepts that write, and mounts `presets.selection` for this reason.
  - The story passes no `features`, so pressing Select does nothing visible in the package's reference demo.
- evidence: read
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

<!-- done: 7 findings, files read: 18 -->