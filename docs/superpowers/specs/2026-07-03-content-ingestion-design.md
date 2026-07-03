# External-content ingestion — design

**Date:** 2026-07-03
**Status:** approved (design review with user)
**Tracks:** `docs/TODO.md` P1 "External-content ingestion"

## Problem

The kit has no path for external content to enter a weasel app. Nothing
handles `dragenter`/`dragover`/`drop` with `dataTransfer.files` (the
`pointerDrag` drop zones are kit-internal drag payloads), the clipboard
feature is the in-memory `ClipboardSnapshot` node buffer (no
`ClipboardEvent` handling), and there is no file-picker helper. Any
consumer wanting "drag a file onto the canvas" or "Cmd+V an image"
hand-rolls DOM listeners today.

This surface is the prerequisite for the native raster-image tool (file
picker / drop / paste of images), and generalizes to any consumer content
type — e.g. a label editor registering handlers for CSV or its own
document format.

## Shape

**Gesture in, registry out.** Drop and paste are bona fide gestures (per
`docs/taxonomy.md`: a gesture is *how* input arrives). They are
normalized by the dispatcher into one payload and routed — via a default
ambient binding — to a single `ingest` action, which consults a
MIME-keyed **content-handler registry**. The file picker is an
app-initiated helper that feeds the same payload into the same action, so
all three arrival paths converge on one handler registry.

```
OS drop ──┐
paste ────┼→ IngestPayload → ingest action → content-handler registry → handler → ops
picker ───┘                                   (kit ships image/*)
```

## 1. Gesture layer

### New gesture specs (`@weasel-js/gestures`)

Two members join the `GestureSpec` union
(`packages/gestures/src/ui/spec.ts`):

```ts
interface DropSpec  { kind: 'drop';  types?: string[] }  // MIME globs, e.g. ['image/*']
interface PasteSpec { kind: 'paste'; types?: string[] }
```

`types` filters matching: the binding matches when **any** normalized
item's MIME matches any glob. Omitted = match any ingest payload.

### Dispatcher listeners

`useGestureDispatcher` gains:

- `dragover` / `dragleave` / `drop` on the **canvas element** (same
  target as its pointer/wheel listeners). `dragover` calls
  `preventDefault()` to make the canvas a valid drop target and toggles
  drag-over feedback (§6).
- `paste` on **window** (same target as its keydown/keyup listeners).
  Guard: ignore paste events whose target is an editable element (text
  edit overlays, inputs) so the scene doesn't steal text-editing pastes.

### Normalized payload

```ts
type IngestItem =
  | { kind: 'file';   mime: string; file: File }
  | { kind: 'string'; mime: string; text: string };

interface IngestPayload {
  items: IngestItem[];
  /** World coords of the drop point; null for paste / point-less picker calls. */
  point: { x: number; y: number } | null;
  modifiers: ModifierState;
}
```

- Files come from `dataTransfer.files` / `clipboardData.files`.
- Strings: `text/plain`, `text/html`, `text/uri-list` items are read
  into `text` **eagerly, during the event dispatch** — `DataTransfer`
  items are only live while the event is on the stack, so normalization
  must complete (string reads kicked off via `getAsString`, collected)
  before any async handler work begins. The payload handed to routing is
  fully materialized and async-safe.
- Drop `point` = `clientX/Y` → world via the current view transform.

## 2. Routing — the `ingest` action

A kit-registered action:

```ts
{
  id: 'ingest',
  label: 'Insert external content',
  defaultBinding: [{ kind: 'drop' }, { kind: 'paste' }],
  // ambient scope (default) — works regardless of active tool
  invoker: /* immediate; receives IngestPayload */,
}
```

Because drop/paste are real gestures, a tool can still bind
`{ kind: 'drop', types: [...] }` directly to intercept drops while that
tool is active — normal binding precedence applies. The ambient `ingest`
binding is the fallback that makes drop/paste work out of the box.

## 3. Content-handler registry

Per-trait registry idiom (like `NodeShape` / `NodeRouting`): a kit-owned
registry with `register` / `find` / `getAll`, entries ordered by
priority.

```ts
interface ContentHandlerEntry {
  id: string;
  /** MIME glob(s) ('image/*', 'text/csv') or an item predicate. */
  match: string | string[] | ((item: IngestItem) => boolean);
  /** Higher wins ties; kit defaults register low so consumers beat them. */
  priority?: number;
  handle(items: IngestItem[], ctx: IngestCtx): void | Promise<void>;
}

interface IngestCtx {
  point: { x: number; y: number } | null;  // world; null → handler picks policy (viewport center)
  view: ViewTransform;
  viewportCenterWorld(): { x: number; y: number };
  applyBatch(ops: Op[], label?: string): void;
  adapter: unknown;           // same opacity contract as ToolCtx
  selection: SelectionApi;
}
```

**Partitioning:** per ingest event, items are partitioned across handlers
in priority order — the first matching handler takes all items it
matches; leftover items continue down the list. A mixed drop (PNG + CSV)
fans out to two handlers, each seeing only its own items.

**Unmatched items:** ignored, with `dwarn('ingest', …)` — silent in
normal operation, a `console.warn` when the `ingest` debug namespace is
enabled (`src/debug/flag.ts` idiom).

**Handler errors:** a throwing/rejecting handler logs `console.warn` and
does not block other handlers' items.

**Async:** `handle` may be async (image decode, file reads). Commits go
through ops via `ctx.applyBatch`, so results are undoable regardless of
timing.

## 4. Kit image handler (the one shipped handler)

Registered by default (low priority so consumers can override):

- **Match:** `image/*` files.
- **src policy:** file → `data:` URI via `FileReader` by default, so the
  scene stays fully serializable with zero consumer work. Override:
  `resolveSrc(file) => Promise<string>` — the seam for consumers that
  upload to their own asset store or want `blob:` URLs.
- **Size:** decode (via the existing `imageCache` path) for natural pixel
  size; clamp to fit the current viewport if larger, preserving aspect.
- **Placement:** node centered on `ctx.point` (drop); when `point` is
  null (paste / point-less imperative calls) → `viewportCenterWorld()`.
  Multi-file ingest cascades subsequent nodes by a small fixed offset.
- **Node:** leaf with `data.image = { src }` — same contract as the
  2026-06-27 embedded-image work; inserted via `createInsertOp`
  (undoable). Reuses the insert dep's `'image'` factory where practical.

`resolveSrc` (and future image-handler options) ride on the handler's
registration options; `<SceneCanvas>` exposes an `ingestion` prop to pass
consumer handlers + image options without reaching into the registry
imperatively.

## 5. Imperative surface

- **`ingest(input, point?)`** on `CanvasExtensionApi` (the public
  SceneCanvas ref handle): accepts `File[]` / `IngestItem[]`, normalizes,
  and dispatches through the same `ingest` action → registry. This is how
  the picker path and programmatic inserts converge.
- **`openFilePicker({ accept?, multiple? }): Promise<File[]>`** — a small
  DOM helper export (hidden `<input type="file">`). The upcoming image
  tool composes `openFilePicker` + `ingest`. Placement UX for the picker
  flow (auto-center vs. Illustrator-style stamp) is deferred to the
  image-tool design; this surface only needs the optional `point`.

## 6. Drag-over feedback

v1 minimal: while a drag hovers the canvas, the dispatcher toggles a
class (`weasel-dropover`) on the canvas element; consumers style it (no
kit-drawn chrome). The demo shows a styled example. Richer feedback
(insertion ghost, per-handler accept/reject cursor) is deferred.

## 7. Out of scope

- **OS clipboard export** (copy *out* of the scene) — existing P2 item.
- **SVG-file → scene-node parsing** — a future handler; will prove the
  registry's extensibility but ships separately.
- **Internal drag-zone payloads** (`pointerDrag` zones) — different
  semantics, already served; not folded into this surface.
- **Image-tool UX** (picker stamp placement, drag-preview ghost) — next
  phase, consumes this surface.

## 8. Testing

- **Normalization:** synthetic `DragEvent` / `ClipboardEvent` (jsdom;
  polyfill `DataTransfer` where needed) → correct `IngestPayload`,
  including eager string materialization and editable-target paste guard.
- **Registry:** partitioning across handlers by priority, predicate
  matches, unmatched → `dwarn` only, handler throw doesn't block others.
- **Image handler:** file → `data:` URI on the node, `resolveSrc`
  override honored, drop-point vs. viewport-center placement, fit-clamp,
  multi-file cascade, insert is undoable.
- **Dispatcher routing:** ambient binding fires regardless of active
  tool; a tool-level `drop` binding intercepts.
- **Demo** (`apps/site/demos/`): drop + paste + picker button + a custom
  `text/plain` handler (drops text as a text node or readout) proving
  consumer extension; drag-over styling shown.

## 9. Documentation

- `docs/taxonomy.md`: add drop/paste to the gesture list.
- `docs/TODO.md`: mark the P1 entry as in-flight → shipped; image-tool
  follow-ups stay under their own entry.

## Decisions log

- **Embed-by-default (`data:` URI) with `resolveSrc` override** — scene
  serializability out of the box; the override is the flexibility seam.
- **Payload normalizes files + strings from day one** — genericity is
  cheap in the payload shape and annoying to retrofit; only the image
  *handler* ships now.
- **Gesture in, registry out** — drop/paste are gestures (taxonomy);
  tool-independent default routing via one ambient `ingest` action;
  handlers in a per-trait-style registry shared by all arrival paths.
- **Unrecognized content: ignore + `dwarn('ingest')`** — silent unless
  the debug namespace is on.
