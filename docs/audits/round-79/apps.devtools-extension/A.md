# Audit round 79: apps.devtools-extension

## A panel the relay replaces reconnects at once and replaces its replacement, forever
- where: apps/devtools-extension/src/panel/portTransport.ts:62 (open, onDisconnect listener); apps/devtools-extension/src/background/relay.ts:150 (connectPanel)
- scenario: two panel pages send a hello for the same `inspect` tab id (e.g. two devtools targets that report the same `inspectedWindow.tabId`, such as -1 for non-tab targets). `connectPanel` calls `t.panel?.disconnect()` on the first. The first transport's `onDisconnect` cannot tell a deliberate kick from the background dying, so it calls `open()`, sends a hello, and the relay now kicks the second panel. The second reconnects the same way, and the two ping-pong without end, each sending `yo` and re-waking the tab every round. The client's `replaced()` state ("another devtools panel connected … in place of this one") is never reached. The expected behavior is that the replaced panel stays down, or that the relay refuses the newcomer.
- evidence: read
- severity: low

## After a panel is replaced, the relay's errors for the old panel's requests reject the new panel's requests
- where: apps/devtools-extension/src/background/relay.ts:104 (drop) and :150 (connectPanel)
- scenario: panel A has requests 5 and 6 in flight to frame 1, so `frame.asked = {5, 6}`. Panel B connects for the same tab. `connectPanel` swaps `t.panel` but leaves each frame's `asked` alone. B's transport numbers its own requests from 1, so its ids 5 and 6 are live in B's `asked`. When frame 1 then unloads, `drop` posts untagged `error` messages for 5 and 6 to B. The client's session filter passes untagged messages, so B's own requests 5 and 6 are rejected with "frame 1 went before it answered" even though B never sent them to that frame. The relay should clear every frame's `asked` when the panel changes.
- evidence: read
- severity: low

## Requests the page never answers stay in both request tables until the session ends
- where: apps/devtools-extension/src/panel/portTransport.ts:27 (asked); apps/devtools-extension/src/background/relay.ts:89 (fromPage, root-removed)
- scenario: the panel asks about a root that is then removed. `client.ts` notes that the page never answers a request about a root that went. The client drops its pending entry on `root-removed`, but the transport's `asked` map and the relay's `frame.asked` set each keep one entry per such request. The transport's map clears only on `yo` or a port drop, and the relay's set only when the frame drops. A long session on a page whose canvases mount and unmount while the panel is polling them (trace, state, history) therefore grows both tables without a bound. On a frame drop, the relay also posts a stale error for every one of those entries.
- evidence: read
- severity: low

## probeFrame reads the page's `kitVersion` outside its try, so a broken hook fails the frame's probe
- where: apps/devtools-extension/src/tabWeasel.ts:27 (probeFrame)
- scenario: a page whose `__weaselDevtools__.kitVersion` is a getter that throws, or an object whose `toString` throws. `String(hook.kitVersion ?? '')` runs after the try and throws inside `executeScript`, so that frame yields no result. If it is the only frame with a hook, the badge shows nothing, `answerProbe` answers absent, and the devtools page never adds the panel. The comment above says that "a foreign or broken hook counts as one with no canvases", and only `roots()` is guarded to honor it.
- evidence: read
- severity: low

## Files read
apps/devtools-extension/manifest.ts
apps/devtools-extension/scripts/build.ts
apps/devtools-extension/scripts/gen-icons.ts
apps/devtools-extension/scripts/safari.ts
apps/devtools-extension/scripts/zip.ts
apps/devtools-extension/src/background/badge.ts
apps/devtools-extension/src/background/frames.ts
apps/devtools-extension/src/background/main.ts
apps/devtools-extension/src/background/relay.ts
apps/devtools-extension/src/background/wake.ts
apps/devtools-extension/src/browserApi.ts
apps/devtools-extension/src/content/bridge.ts
apps/devtools-extension/src/content/main.ts
apps/devtools-extension/src/content/start.ts
apps/devtools-extension/src/devtools/main.ts
apps/devtools-extension/src/envelope.ts
apps/devtools-extension/src/hookPresence.ts
apps/devtools-extension/src/panel/PanelHost.tsx
apps/devtools-extension/src/panel/main.tsx
apps/devtools-extension/src/panel/panel.css
apps/devtools-extension/src/panel/panel.module.css
apps/devtools-extension/src/panel/portTransport.ts
apps/devtools-extension/src/popup/main.ts
apps/devtools-extension/src/popup/popup.css
apps/devtools-extension/src/popup/status.ts
apps/devtools-extension/src/tabWeasel.ts
apps/devtools-extension/src/testing/fakePorts.ts
apps/devtools-extension/vite.config.ts

<!-- done: 4 findings, files read: 28 -->
