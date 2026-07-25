# OS clipboard interop — design (Phase 2b)

**Status:** approved 2026-07-25
**Packages:** `@weasel-js/core` (`src/interactions/actions/clipboard/`, `src/features/ingestion/`, `src/canvas/SceneCanvas.tsx`), `apps/draw`
**Predecessors:** `2026-07-25-unify-scene-history-engine-design.md` (Phase 1),
`2026-07-25-scene-history-persistence-design.md` (Phase 2a). This is "Phase 2b" — the OS-clipboard
half of the original clipboard/serialization P2 pair.
**TODO item:** "(P2) Clipboard: OS clipboard / cross-reload serialization."

## Problem

The kit's clipboard is two disconnected halves:

1. **Internal copy/paste** (`useClipboardOps`) holds a `ClipboardSnapshot { items: TNode[] }` in a
   React ref. Copy = `adapter.snapshotSelection(ids)`; paste = `adapter.commitPaste(snapshot,
   offset)` → insert ops. It never touches the OS clipboard: the buffer dies on reload and is
   invisible to other tabs, documents, and applications.
2. **Inbound-only OS ingestion** already exists: the gesture dispatcher listens for window `paste`
   events (skipping text-input targets), materializes `clipboardData` into MIME-typed
   `IngestItem[]`, and routes them through the registered content-handler chain
   (`registerContentHandler`; the kit registers image + SVG handlers in `registerKitHandlers`).
   External images/SVG paste in; weasel's own content does not.

Joining the halves gives cross-tab / cross-reload / cross-document paste of weasel nodes, and
(via per-app flavor overrides) meaningful paste of weasel content into external tools.

## Decisions (made during brainstorming)

- **Interop ambition:** copied content also lands on the OS clipboard as real SVG for other
  apps — but flavor production is **overridable per app** via a kit seam. The kit itself cannot
  emit SVG (its `TData` is opaque); apps that can (draw has full bidirectional SVG interop in
  `svgExport.ts`/`svgInterop.ts`) supply it through the override.
- **Hybrid paste policy:** Cmd+V routes through the existing OS ingestion path; the imperative
  `paste()` (toolbar buttons, action descriptors) keeps the in-memory snapshot as its source —
  fast, no permission prompts. `copy()` always writes both, keeping the two consistent.
- **Outbound seam placement:** grow `useClipboardOps` (a `produceFlavors` option with a kit
  default) rather than a separate bridge hook or app-level plumbing.

## Design

### 1. Wire format

```ts
/** Versioned OS-clipboard payload. `weaselClipboard: 1` doubles as the
 *  sniff marker when the payload rides in text/plain. */
interface WeaselClipboardPayload {
  weaselClipboard: 1;
  nodes: unknown[]; // ClipboardSnapshot.items, serialized
}
```

- MIME: **`application/x-weasel-clipboard+json`**.
- `nodes` is the adapter-shaped `ClipboardSnapshot.items` passed through an optional consumer
  **replacer** (draw supplies its typed-array `serializeReplacer`; revival uses its
  `reviveTypedArrays`) — the same pattern persistence uses. The kit default is plain
  `JSON.stringify`/`JSON.parse`.
- **Sniffability:** browsers that drop custom clipboard formats still carry `text/plain`; the
  inbound handler recognizes weasel payloads there via a cheap `"weaselClipboard"` substring
  pre-check followed by a guarded parse + marker check.

### 2. Outbound — `useClipboardOps` grows a flavor seam

New options on `UseClipboardOpsOptions`:

```ts
/** Produce the OS-clipboard flavor map for a copied snapshot. Keys are MIME
 *  types, values the serialized payload. The kit default emits
 *  `application/x-weasel-clipboard+json` plus `text/plain` carrying the same
 *  JSON. Apps override to add richer flavors (e.g. real SVG) or to replace
 *  the text flavor. Return an empty object to skip the OS write entirely. */
produceFlavors?: (snapshot: ClipboardSnapshot) => Record<string, string>;
/** Replacer for the kit-default JSON flavor (typed arrays etc.). Ignored
 *  when `produceFlavors` is supplied. */
jsonReplacer?: (key: string, value: unknown) => unknown;
```

`copy()` behavior: set the in-memory ref (unchanged), then **best-effort** OS write:

1. Build the flavor map.
2. `navigator.clipboard.write([new ClipboardItem({...})])` with the custom MIME attempted under
   Chromium's `web ` prefix (`web application/x-weasel-clipboard+json`) alongside the standard
   flavors.
3. On failure (unsupported custom format, permission denial, API absent — e.g. non-secure
   context, jsdom): retry with standard flavors only; on failure again, degrade to the in-memory
   ref alone with a `dwarn`. **`copy()` never throws and never loses the in-memory write.**
   The OS write is fire-and-forget async; `copy()` stays synchronous from the caller's view.

No DOM `copy`-event path: Cmd+C routes through the kit's copy *action* (which calls this
`copy()`), not native copy semantics.

### 3. Inbound — a kit content handler

`kitWeaselJsonHandler`, registered in `registerKitHandlers` **ahead of** the image and SVG
handlers:

- **Match:** the custom MIME (with or without the `web ` prefix), or a `text/plain` item passing
  the sniff (marker substring + parse + `weaselClipboard === 1`). `ContentHandlerEntry` already
  supports predicates alongside MIME globs.
- **Act:** revive `nodes` (consumer reviver), reconstruct a `ClipboardSnapshot`, and commit
  through the adapter's `commitPaste` seam with the standard paste-offset policy, then select the
  new nodes (parity with the imperative `paste()`). The handler reaches `commitPaste` via
  `SceneCanvas`-threaded ingestion context — mirroring how `svg` options already flow into
  `IngestCtx`; the exact member (new `IngestCtx` field vs. the `deps` bag) is a planning-time
  choice. If the adapter has no `commitPaste`, the handler declines (falls through to other
  handlers) with a `dwarn`.
- **Consumer knobs** on `SceneCanvas`'s existing `ingestion` options: `clipboard?: { reviver?,
  enabled? }` (naming finalized at planning), defaulting to enabled with plain JSON parse.

Same-origin duplicate-id safety is `commitPaste`'s existing responsibility (it already mints new
ids for the ref-based paste path); the OS path reuses it unchanged.

### 4. Draw override

- `produceFlavors` returns: the weasel JSON flavor (built with draw's `serializeReplacer`),
  **`image/svg+xml`**, and **`text/plain` carrying the SVG markup** (what external design tools
  sniff) — the JSON no longer rides text/plain in draw; the custom MIME + cross-tab
  `clipboardData` carry it.
- SVG is produced by a **selection-subset** variant of the existing `sceneToSvgNodes` walk
  (today it walks the whole scene; it gains a roots-subset entry point), serialized via
  `serializeSvg` with the `wd:` namespace so draw→draw paste through SVG would still round-trip
  structure if the JSON flavor were unavailable.
- Inbound reviver: `reviveTypedArrays`. Inbound SVG paste from external tools already works via
  the kit SVG handler — untouched.

### 5. Degradation policy

Never break copy or paste over an interop gap: OS write failures degrade silently (dwarn);
unrecognized/corrupt weasel payloads decline so the ingestion chain's other handlers (SVG, image,
text) get their shot; a missing `commitPaste`/`snapshotSelection` on the adapter keeps today's
no-op behavior.

## What we explicitly are NOT doing

- `navigator.clipboard.read` for imperative paste buttons (in-memory covers same-session; Cmd+V
  covers everything else). No permissions UI.
- `image/png` rasterization of copied nodes.
- Changes to cut semantics or to the in-memory `ClipboardSnapshot` shape.
- Non-browser (SSR/headless) clipboard support beyond not-crashing.

## Testing

- **Wire format:** payload round-trip with typed-array node data (replacer/reviver); sniff
  accepts marker-bearing text/plain and rejects near-misses (plain JSON without the marker,
  marker substring in non-JSON text).
- **Outbound:** `copy()` with `navigator.clipboard` absent / `write` rejecting / custom-format
  throw → in-memory ref always written, no throw, degradation order observed (spy on write
  attempts). Flavor override replaces the default map; empty map skips the write.
- **Inbound:** handler precedence (weasel payload consumed before SVG/image handlers see it);
  custom-MIME and sniffed-text/plain both route to `commitPaste` with new ids + selection;
  corrupt payload declines to the next handler; adapter without `commitPaste` declines.
- **Draw:** `produceFlavors` emits parseable SVG for a selected subset (validated against the
  existing svg-interop fixtures/parse), JSON flavor revives through `reviveTypedArrays`;
  end-to-end serialize → fresh scene → ingest → nodes present with new ids.
- **Regression:** existing clipboard, ingestion, and svg-interop suites unmodified and green;
  full repo gate.

## Open questions (resolve at planning / implementation)

1. **`IngestCtx` plumbing for `commitPaste`** — new explicit member wired by `SceneCanvas` vs.
   reaching through `deps`. Default: explicit member (discoverable, typed).
2. **Cross-tab `DataTransfer` fidelity** — verify the custom MIME survives tab-to-tab paste via
   `clipboardData` in the target browsers; if Chromium only exposes the `web `-prefixed name on
   read, the handler's match list must include both spellings (already specified) — confirm
   empirically in the smoke test.
3. **Selection-subset SVG walk** — whether `sceneToSvgNodes` grows a `roots?: NodeId[]` option or
   a sibling function; pick whichever keeps `svgExport.ts`'s whole-scene path byte-identical.

## Files (anticipated)

- `src/interactions/actions/clipboard/clipboardOps.ts` — `produceFlavors`/`jsonReplacer` options,
  OS write with degradation ladder; `wireFormat.ts` (new) — payload build/sniff/parse helpers.
- `src/features/ingestion/kitWeaselJsonHandler.ts` (new) + `registerKitHandlers.ts` ordering.
- `src/canvas/SceneCanvas.tsx` + ingestion types — `clipboard` ingestion options + ctx plumbing.
- `apps/draw/src/App.tsx` (wire overrides), `apps/draw/src/svgInterop.ts` (subset walk),
  `apps/draw/src/svgExport.ts` (only if the subset entry point lives here).
- Tests alongside each; `docs/TODO.md` closure of the Clipboard P2 entry.
