Note: the brief names frozen commit d4226fab0e3e2669740411edb2a1d35dadeb46b1, which this clone does not have
(`git cat-file` reports a bad object). This review read the tree as it stands at HEAD 4c701b3803. Git status shows no
changes under apps/devtools-extension.

## The content script's run-once marker blocks re-injection into tabs left with orphaned scripts after a Chrome extension reload or update
- where: apps/devtools-extension/src/content/main.ts:5-11 (module body), together with apps/devtools-extension/src/background/main.ts:8-21 (wakeTab)
- scenario: In Chrome, a tab is open while the extension is updated or reloaded. The old content script is orphaned, but
  its isolated world stays alive and still holds `globalThis.__weaselDevtoolsBridge__ = true`. The user opens the panel.
  `wakeTab`'s `tabs.sendMessage` gets no answer, because orphaned scripts cannot receive, so it injects `content.js` with
  `scripting.executeScript`. Chrome runs that injection in the same isolated world, so the new copy finds the marker and
  returns without calling `startContentScript`. The tab never connects. Meanwhile `hookPresence`, which probes through
  MAIN-world `executeScript` and not through the content script, reports the hook present, so the panel mounts
  `DevtoolsPanel`, sends `yo`, and never gets a `sup`. It should connect, which is the case the marker's comment says the
  injection exists for. The marker does not record whether the script that set it still has a live runtime: nothing
  checks `chrome.runtime?.id`, and no per-load token is compared.
- evidence: read. That Chrome reuses the isolated world after a reload is from memory of Chrome's behavior and was not
  run here.
- severity: medium

## wakeTab skips injection when any one frame answers, so an older top frame never gets a content script
- where: apps/devtools-extension/src/background/main.ts:8-21 (wakeTab)
- scenario: A page that runs weasel in its top frame loaded before the extension was installed or reloaded. After that,
  it adds an iframe, such as an embed or an ad. The browser injects the manifest content script into that new frame only.
  The user opens the panel and the relay calls `wake`. `tabs.sendMessage(tabId, CONNECT_REQUEST)`, sent with no
  `frameId`, resolves as soon as the iframe's script calls `respond(true)`, so `wakeTab` returns before the
  `executeScript({ allFrames: true })` fallback. The top frame, where weasel runs, never gets a bridge. The probe still
  reads the hook as present, so the panel shows an empty session. The fallback should run for each frame without a
  bridge, for example by injecting every time and relying on the run-once marker, rather than only when no frame
  answers.
- evidence: read
- severity: low

## A badge probe scheduled before a tab closes re-adds that tab's entry to the probe map and leaves an unhandled rejection
- where: apps/devtools-extension/src/background/badge.ts:17-34 (watchBadges: probe, and the onUpdated/onRemoved listeners); apps/devtools-extension/src/tabWeasel.ts:53-57 (refreshBadge)
- scenario: A tab reaches `complete`, which schedules probes at 0, 1000 and 3000 ms. The tab is closed within 3 s, and
  `onRemoved` deletes its `probes` entry. The later timers still call `probe(tabId)`, which runs `probes.set(tabId,
  createLatest())` again for a tab that no longer exists and will get no second `onRemoved`. Each such tab leaks one
  entry for as long as the background lives; a Firefox event page can live a long time. `refreshBadge` then awaits
  `setBadgeText({ tabId })` on the closed tab. The promise rejects ("No tab with id"), and `void refresh(...)` leaves that
  rejection unhandled. The `void api.action?.setBadgeText(...)` call on `loading` has the same unhandled-rejection
  problem if the tab closes during the call. Timers for a removed tab should be cancelled or ignored, and the badge write
  should catch its rejection.
- evidence: read
- severity: low

## watchHookPresence with an empty `delays` probes in a tight loop forever
- where: apps/devtools-extension/src/hookPresence.ts:23-47 (watchHookPresence, poll)
- scenario: A caller passes `delays: []`. The type, `readonly number[]`, allows it. `poll(gen, 0)` calls
  `after(delays[0])`, which is `after(undefined)`, so `setTimeout(..., NaN)` fires at once. The check `step + 1 >=
  delays.length` (1 ≥ 0) reports false, then `poll(gen, Math.min(1, -1))` runs with step -1. `delays[-1]` is also
  undefined, so it repeats at 0 ms with no end. Each round is a background `executeScript` across every frame of the tab.
  The function should reject an empty list or fall back to the defaults.
- evidence: read
- severity: low

## One port transport outlives each DevtoolsPanel remount, and each new client numbers its requests from 1 again, so a late answer can settle the wrong request
- where: apps/devtools-extension/src/panel/PanelHost.tsx:12-29 (PanelHost), apps/devtools-extension/src/panel/main.tsx:13 (module-level transport)
- scenario: `PanelHost` remounts `DevtoolsPanel` under a new `key` on every presence change, and each mount creates a new
  client whose `nextId` starts at 1 (`packages/devtools/src/client.ts:68`). All of them share the one
  `createPortTransport` built in `main.tsx`. A message for a request the previous client sent still reaches the new
  client: either the page's late `result`, or the relay's `frame N went before it answered` error, which `drop` sends
  when a replaced or disconnected frame is cleaned up. The transport passes it on, and the new client settles its own
  pending request with that same id. That gives it the wrong result, or rejects a request that is still in flight. In
  normal navigations the old frame's port drops before the new hook is found, so the window is narrow. It opens when
  the old port's disconnect reaches the background late, or when the new frame replaces the old one (`connectPage`'s
  `replaced` path) after the new client has already sent requests. Ids should be unique for the transport's lifetime,
  or each mount should get its own transport.
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

<!-- done: 5 findings, files read: 27 -->
