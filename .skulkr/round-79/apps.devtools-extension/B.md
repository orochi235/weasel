# Audit round 79: apps.devtools-extension

## The popup writes the badge outside the background's per-tab latest gate, so a stale probe can overwrite a newer one
- where: apps/devtools-extension/src/popup/main.ts:12 (top level, `refreshBadge(api, active.id)` with the default `current = () => true`); gate it bypasses: apps/devtools-extension/src/background/badge.ts:17-24 (`probes` / `createLatest`)
- scenario: a page installs its hook late. The popup opens at t0 and its probe runs before the hook exists. The background's 1000 ms probe starts just after, sees the hook, and writes "1" first. The popup's probe resolves second and writes "", because nothing tells it a later probe overtook it. The badge then shows nothing on a page running weasel until the next navigation, since the background schedules no further probes. The same happens if the tab navigates while the popup's probe runs: the old page's answer lands after the background's `loading` clear. The question "may this probe still write the badge?" is answered in two places, the background's per-tab `Latest` and the popup's always-true default.
- evidence: read
- severity: low

## The panel transport reconnects immediately and forever when the background drops its port at once
- where: apps/devtools-extension/src/panel/portTransport.ts:60-68 (`open`, the `onDisconnect` listener); the relay drop that feeds it: apps/devtools-extension/src/background/relay.ts:150-152 (`connectPanel`, `t.panel?.disconnect()`)
- scenario: two panel ports inspect one tab, for example a Firefox toolbox opened from about:debugging beside the tab's own toolbox. Each panel's hello makes the relay disconnect the other. The other's `onDisconnect` calls `open()` with no delay and sends a hello of its own, which disconnects the first, and so on. The two panels ping-pong without end, and every round also runs `wake` (`executeScript` into every frame plus `tabs.sendMessage`). A background that has no `onConnect` listener (its script threw at top level) also disconnects every port at once, and that too becomes a tight reconnect loop in the panel. Nothing counts failed attempts and there is no backoff, so no reconnect is ever given up.
- evidence: read (the two-toolbox trigger is inference about Firefox; the loop itself follows from the code)
- severity: low

## The popup's title shows the first frame's kit version when frames run different weasel versions
- where: apps/devtools-extension/src/tabWeasel.ts:37 (`summarize`, `kitVersion: found[0]!.kitVersion`)
- scenario: the top frame runs weasel 1.4.0 and an embedded iframe runs 1.2.0. `summarize` keeps only the version of whichever frame `executeScript` listed first, and the popup's title reads "weasel 1.4.0" above "3 canvases in 2 frames on this page." The other version is never shown. A first frame whose hook has no `kitVersion` (`''`) gives the bare title "weasel" even though another frame reports one.
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

<!-- done: 3 findings, files read: 28 -->
