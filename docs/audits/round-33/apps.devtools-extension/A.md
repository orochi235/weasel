# Audit round 33 — apps.devtools-extension (blind reviewer)

Note: the brief names frozen commit d4226fab0e…, which is not in this clone (`git cat-file` reports a bad
object). The tree was read at HEAD 4c701b3803; `git status` shows no uncommitted changes under
`apps/devtools-extension`.

## After an extension reload in Chrome, re-injecting content.js into an already-open tab is a no-op, so the panel never connects
- where: apps/devtools-extension/src/content/main.ts:8 (module guard), with apps/devtools-extension/src/background/main.ts:16 (wakeTab)
- scenario: a tab loads with the extension installed, so content.js runs and sets `globalThis.__weaselDevtoolsBridge__ = true` in the extension's isolated world. The developer reloads the extension and opens the weasel panel on that same tab. The old content script is now orphaned: its `runtime` is invalidated and it doesn't answer `CONNECT_REQUEST`. So `wakeTab` falls through to `scripting.executeScript({ files: ['content.js'] })`. Chrome runs re-injected scripts for the same extension id in the same isolated world as the orphan, so the new copy finds the marker already set and returns without calling `startContentScript`. The second `sendMessage` then rejects, the error is swallowed, and the panel sits empty until the page is reloaded. The guard should key on something an orphan can't leave behind: check whether `runtime.id` is still valid, or store a per-load token rather than `true`. Firefox gives a reloaded extension a fresh sandbox, so this is Chrome/Edge only.
- evidence: read (the code path). That Chrome reuses the isolated world across an extension reload is inference from known Chrome behavior; I did not run it.
- severity: medium

## wakeTab stops injecting as soon as any one frame answers, so frames without a live content script are never bridged
- where: apps/devtools-extension/src/background/main.ts:10 (wakeTab)
- scenario: `tabs.sendMessage(tabId, …)` with no `frameId` goes to every frame and resolves on the first reply. Two cases:
  - **Partial reload.** A tab was open before the extension was installed or reloaded, and one iframe has since navigated, so only that iframe has a current content script. The iframe answers, `wakeTab` returns, and the top frame, which still has no live script, is never injected. Its weasel canvases never reach the panel.
  - **Frames the manifest can't reach.** The manifest has no `match_about_blank` / `match_origin_as_fallback` (manifest.ts:29), so an `about:blank`, `srcdoc` or `blob:` iframe gets no content script. The top frame's script answers, so the fallback injection never runs for that frame either.

  The second case is worse if `probeTab`'s `executeScript({ allFrames: true })` does reach such frames (inference, not verified). Then the badge and `hookPresence` report weasel, the panel is created, and its roots never appear. The fallback should inject per frame (for example by `frameIds`) whenever a frame with a hook has no connected port, rather than only when no frame answers at all.
- evidence: read. That `executeScript` reaches about:blank/srcdoc frames is inference.
- severity: medium

## A tab closed within 3 s of loading leaves a permanent entry in the badge probe map
- where: apps/devtools-extension/src/background/badge.ts:29 (watchBadges), with :18-21 (probe) and :31-33 (onRemoved)
- scenario: a tab reaches `status: 'complete'`, which schedules probes at 0, 1000 and 3000 ms. The tab is closed at 500 ms, and `onRemoved` deletes its `probes` entry. At 1000 ms and 3000 ms `probe(tabId)` runs anyway, finds no entry and `probes.set`s a new `Latest` for the dead tab id. No later `onRemoved` arrives for it, so the entry is never deleted, and each such tab also costs an `executeScript` against a tab that no longer exists. In Firefox's event page, or a long-lived Chrome worker, the map grows by one entry per quickly-closed tab. The pending timers should be cleared on `onRemoved`, or `probe` should skip tabs that have been removed.
- evidence: read
- severity: low

## watchHookPresence reports `false` twice in a row, despite promising to report only changes
- where: apps/devtools-extension/src/hookPresence.ts:48-49 (restart), with :39 (poll)
- scenario: the page has a hook (`last = true`) and navigates to a page without one. `restart` calls `tell(false)`, which reports false and sets `last = false`, then sets `last = null`. When the delays run out, `tell(false)` compares against `null` and reports false a second time. The same happens on every navigation between two pages without a hook: `last` goes from false to null, then false is reported again. The docstring says "Report `present` on every change of answer". `PanelHost` bumps `page` on every report (PanelHost.tsx:16), so each duplicate re-renders the panel for nothing. Leaving `last` as false after the drop (`if (last) tell(false); else last = null;`) would keep the contract.
- evidence: read
- severity: low

## probeFrame trusts the page's `roots()` to return an array, so a stray hook turns the badge and popup count into NaN
- where: apps/devtools-extension/src/tabWeasel.ts:19 (probeFrame), :27 (summarize)
- scenario: a page has some other global named `__weaselDevtools__` whose `roots()` returns something without a numeric `length`, such as an object or a Map. That can be an older or foreign hook. `probeFrame` returns `roots: undefined`. `summarize` adds it into `NaN`, so the badge shows "•" and the popup says "NaN canvases on this page." Nothing checks `Array.isArray(...)` or `Number.isFinite` on the count. And if `roots()` throws, that frame's result is lost (depending on the browser, so may the whole probe), which hides weasel in the tab's other frames.
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
