# weasel devtools extension

A browser devtools panel for pages running weasel: it connects to the page's devtools hook
(`window.__weaselDevtools__`, described in [`docs/devtools.md`](../../docs/devtools.md)) and hosts
`DevtoolsPanel` from `@weasel-js/devtools`, the same panel weasel mounts in-page. One Manifest V3 codebase serves Chrome, Edge, and Firefox;
Safari takes the Chrome build through an Xcode wrapper. Private: it is not published to npm.

Its toolbar button shows whether a tab runs weasel: the badge counts the page's canvases (`•` for a
hook with none), and clicking it names the kit version and says where the panel is.

The panel tab appears once the inspected page has a hook. That means a dev build with a mounted
`<SceneCanvas>`, or a production build that imports `@weasel-js/core/devtools`.

## Build

From the repo root:

| Command | Produces |
|---|---|
| `npm run build:devtools-extension` | `apps/devtools-extension/dist/chrome/` and `dist/firefox/`, each with its own `manifest.json` |
| `npm run zip:devtools-extension:chrome` | `dist/weasel-devtools-chrome.zip`, for the Chrome Web Store or Edge Add-ons |
| `npm run zip:devtools-extension:firefox` | `dist/weasel-devtools-firefox.zip`, for addons.mozilla.org |
| `npm run safari:devtools-extension` | an Xcode project in `apps/devtools-extension/safari/` (gitignored) |
| `npm run gen:devtools-extension-icons` | `public/icons/icon-{16,32,48,128}.png`, rendered from the site's logo (`apps/site/assets/weasel-logo.svg`); rerun after the logo changes |

Each build replaces the one before it, in `dist/` (gitignored).

## Load it unpacked

**Chrome:** open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and
pick `dist/chrome`. Pin it from the puzzle-piece menu to keep its button in the toolbar. Open
devtools on a weasel page; the **weasel** tab is among the panels. After a
rebuild, click the reload arrow on the extension's card and reopen devtools.

**Edge:** the same at `edge://extensions`, with **Developer mode** in the left rail.

**Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and pick
`dist/firefox/manifest.json`. A temporary add-on lasts until Firefox quits. Firefox treats MV3 host
permissions as opt-in: in `about:addons`, open the extension's **Permissions** tab and allow it on
all sites, or the content script never runs.

## Package it for Safari

Safari runs WebExtensions inside a macOS app. `npm run safari:devtools-extension` builds that app's
Xcode project from `dist/chrome` with `xcrun safari-web-extension-converter`, passing `--no-open`
and `--no-prompt`, so it neither opens Xcode nor waits for an answer. Then:

1. Open the `.xcodeproj` under `safari/weasel devtools/` and run the app (**Product → Run**).
   Running it installs the extension.
2. In Safari, turn on **Settings → Advanced → Show features for web developers**, then
   **Develop → Allow Unsigned Extensions** (asked again after each Safari restart).
3. Enable **weasel devtools** in **Settings → Extensions** and allow it on the sites to inspect.

The project copies the built files, so rerun the script after each build.

## How it works

| Piece | Source | Job |
|---|---|---|
| content script, every frame | `src/content/` | As it loads, asks the background whether a panel is open on its tab, and connects if so; otherwise it stays idle until the background asks it to connect. Once connected it carries devtools envelopes between the page's `window.postMessage` and a port to the background. It never touches page objects. |
| background | `src/background/` | Pairs each panel with the content scripts of the tab it inspects, by tab id. Either side may connect first. When the panel goes, it sends the page `bye` so the page drops its overlays and stops tracing. |
| devtools page | `src/devtools/` | Adds the **weasel** panel the first time the inspected page has a hook. |
| toolbar button | `src/tabWeasel.ts`, `src/background/badge.ts`, `src/popup/` | Reads each frame's hook in the page's own world with `scripting.executeScript`, when a tab finishes loading and again 1 s and 3 s later (a hook can arrive after load), on install for every open tab, and when the popup opens. Sets that tab's badge; the popup shows the same answer. |
| panel page | `src/panel/` | Renders the panel over a `PanelTransport` on its port, or "No weasel on this page" while there is no hook. A new page gets a fresh panel. |

`src/browserApi.ts` reads the API from `browser` (Firefox, Safari) or `chrome` (Chrome, Edge).

A tab with weasel in several frames shows one list of roots: the top frame's ids as they are, and
each other frame's as `frame<N>/<id>`, labeled `(frame N)`. A frame that loads while the panel is
open connects as it loads, and the background replays the panel's `yo` to it. The cost is one
message to the background from every frame that loads, panel or no panel; it wakes a stopped
background, which goes idle again.

The content script and the background are each one classic script with nothing loaded later, as
MV3 requires of a content script; `vite.config.ts` builds them separately from the two pages.

## Tests

`npx vitest run --project=draw apps/devtools-extension/<file>` runs one file. They cover the relay,
the content script's bridge and its connecting, the panel's port transport and page, and one jsdom
test that runs a real hook through all of them into `DevtoolsPanel`.
