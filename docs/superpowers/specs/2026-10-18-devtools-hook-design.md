# Devtools hook — a protocol for inspecting a running weasel app

**Status, 2026-10-18: unbuilt.** Designed only; nothing below exists in the tree yet.

For whoever implements layer 1 of the `docs/TODO.md` "Devtools" entry. Assumes familiarity with
`<SceneCanvas>`, the dispatcher, and the debug overlay; not with browser extensions.

The question it answers: **what does the page expose so that a panel — mounted in the page or in
a browser extension — can show a weasel app's scene, routing, and frame stats, and steer them?**

The panel (layer 2) and the extension (layer 3) are out of scope; this spec defines what they
talk to.

## Decisions

- Production exposure is a per-app choice (2026-10-18). Dev builds install the hook behind
  `isDev()`; a production build installs it only when the app imports `@weasel-js/core/devtools`.
  An app that does not opt in ships none of it.
- The panel inspects and steers; it never edits the scene (2026-10-18). Commands are limited to
  selecting, highlighting, switching the active tool, and toggling debug overlays.
- Data moves as messages, notify-then-pull (2026-10-18). The page announces that an area changed;
  the panel requests only what it displays. Cost scales with what the panel shows, not with scene
  size, and nothing runs until a panel connects.

## Roots and the global

A **root** is one mounted `<SceneCanvas>`. A page with several canvases (`isolate`, or a
kernel3d canvas beside a 2D one) has several roots. `<SceneCanvas>` registers its root through
`useDevtoolsRoot`, beside its existing `useTestHook` call, and removes it on unmount.

`window.__weaselDevtools__` holds `{ protocol, roots, connect(transport) }`. Installing it also
starts a `window` `message` listener that answers `yo`, because an extension's content script
runs in an isolated world and cannot see page objects. That listener is the only cost before a
panel connects.

## Messages

Every message carries `protocol` (an integer) and, after the handshake, `rootId`. Requests carry
a request id that the `result` or `error` reply echoes.

| Direction | Message | Carries |
|---|---|---|
| panel → page | `yo` | the panel's protocol version |
| page → panel | `sup` | the page's protocol version, the kit version, the current roots |
| page → panel | `root-added` / `root-removed` | id, label (the canvas's `aria-label` or DOM id), `2d` or `3d` |
| page → panel | `changed` | the areas that moved — `scene`, `selection`, `view`, `tool`, `trace`, `frame` — each with a version; at most one per animation frame |
| panel → page | `get-children` | a node id, or none for the top level → per child: id, kind, layer, child count, hidden/locked/pickable |
| panel → page | `get-node` | id → pose and data, safely serialized |
| panel → page | `get-state` | → selection, view, active tool, registered tools, effective overlay flags, probe values |
| panel → page | `get-trace` | cursor, and whether to include coord records → dispatch and mode-switch records since the cursor, and the new cursor |
| panel → page | `get-frame` | → the debug sink's last frame stats |
| panel → page | `select` / `highlight` / `set-tool` / `set-overlays` | the steering commands |
| page → panel | `result` / `error` | the reply to a request |

A protocol mismatch gets an `error` reply naming both versions, never a throw; the panel decides
how far to degrade.

**Safe serialization.** Node `data` is the app's type and need not be JSON-safe. The serializer
caps depth and collection length, writes a function as `ƒ name`, a typed array as its type and
length, and a cycle as a marker. Poses go through the same serializer, so a `Pose3` arrives as
plain numbers with no 2D assumption.

**Overlays.** `set-overlays` layers over the canvas's own `debug` prop and is dropped when the
panel disconnects, so closing devtools restores the app's setting.

**Highlight** outlines a node through the debug overlay layer, the way hovering in the Elements
panel outlines an element.

**Transports.** A transport is `send(msg)` and `onMessage(fn)`. Two ship: an in-page transport
(direct calls) for forge, the site, and draw; and a `window.postMessage` transport whose envelope
is tagged so other traffic on the page is ignored.

## What moves

| Today | After |
|---|---|
| `window.__weaselTest` (`packages/core/src/test-hook/`) | same API and `?test=1` gate, reading through the root; its probes live in the root's registry and appear in `get-state` |
| `window.__weaselDispatchLog__` and `__weaselDispatchLive__`, module-global (`packages/routing/src/interactions/dispatcher/dispatchTrace.ts`) | removed; one trace buffer per dispatcher, read by its root's `get-trace`. Records while the build is dev or a panel is connected, so an opted-in production app traces only while inspected |
| `window.__weaselCoordLog__`, module-global (`packages/core/src/canvas/SceneCanvas/coordTrace.ts`) | removed; one buffer per canvas, behind `get-trace` |
| `apps/draw/src/dev/DispatchTracePanel.tsx`, `toolkit/DispatchTraceWidget.tsx` polling the global | read through the in-page transport |

Code lives in `packages/core/src/devtools/`. Protocol types and both transports are exported from
the `@weasel-js/core/devtools` subpath, which is also the production opt-in import.

## Testing

- `core` project: serializer edge cases (functions, cycles, typed arrays, depth and length caps);
  every request against a real scene over the in-page transport; `changed` coalescing to one per
  frame; mismatch answered with `error`; overlay overrides dropped on disconnect.
- Migration guard: the existing `__weaselTest` tests and the site demo tests using it pass
  unchanged.
- `*.browser.test.tsx`: `highlight` and `set-overlays` put pixels on the canvas.
- Production gating: with dev off, no hook unless the subpath was imported.
