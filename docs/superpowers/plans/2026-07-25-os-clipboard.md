# OS Clipboard Interop (Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy in weasel writes real flavors to the OS clipboard (weasel JSON + per-app SVG override); Cmd+V pastes weasel content across tabs/reloads/documents through the existing ingestion chain — after first making the kit's dormant clipboard seam real and migrating draw onto it.

**Architecture:** `sceneAdapter` gains `snapshotSelection`/`commitPaste`/`getPasteOffset` (subtree-aware, fresh ids, insertion stays on the existing insert-op path). Draw drops its hand-rolled clipboard for `useClipboardOps`. The hook grows a `produceFlavors` seam + best-effort `navigator.clipboard.write` ladder; a new `kitWeaselJsonHandler` (priority −50) consumes weasel payloads ahead of the kit image/SVG handlers via a new `IngestCtx.clipboard` member wired by `SceneCanvas`. Draw overrides flavors with SVG from a selection-subset `sceneToSvgNodes` walk.

**Tech Stack:** TypeScript, vitest (projects: `kit` for `src/`, `draw` for apps/draw), tsup, Playwright MCP for the browser smoke.

**Spec:** `docs/superpowers/specs/2026-07-25-os-clipboard-design.md` (approved; includes the "Corrections at planning" scope expansion). Open questions resolved here: (1) `IngestCtx` gains an explicit `clipboard` member; (2) cross-tab custom-MIME spelling verified empirically in the Task 6 smoke — the handler matches both spellings regardless; (3) `sceneToSvgNodes` gains an optional `roots` parameter (whole-scene path byte-identical when omitted).

**Files:**
- Modify: `src/canvas/sceneAdapter.ts` (+ its test file)
- Modify: `apps/draw/src/App.tsx`
- Create: `src/interactions/actions/clipboard/wireFormat.ts` (+ test)
- Modify: `src/interactions/actions/clipboard/clipboardOps.ts` (+ test), `.../clipboard/index.ts`
- Create: `src/features/ingestion/weaselJsonHandler.ts` (+ test)
- Modify: `src/features/ingestion/registerKitHandlers.ts`, `src/features/ingestion/contentHandlers.ts` (IngestCtx), `src/canvas/SceneCanvas.tsx`, `src/interactions/dispatcher/useGestureDispatcher.tsx` (ctx plumbing)
- Modify: `apps/draw/src/svgInterop.ts`, `src/index.ts` (exports), `docs/TODO.md`

**Controller notes for the executor:** dispatch one implementer per task; worktree-absolute paths in every subagent prompt; two-stage review per task; the plan intentionally specifies contracts + shapes rather than every line for Tasks 1–2 (the implementer must read the named files first — `sceneAdapter.ts`'s node shape and `insertNode` mapping are the source of truth).

---

### Task 0: Baseline

- [ ] Work in `/…/.claude/worktrees/os-clipboard` (branch `os-clipboard`, spec committed). `npm install`; `npm run typecheck && npx vitest run --project=kit src/canvas src/interactions/actions/clipboard src/features/ingestion && npx vitest run --project=draw` all green.

---

### Task 1: Kit adapter clipboard seam (`sceneAdapter`)

**Files:** Modify `src/canvas/sceneAdapter.ts`; Test `src/canvas/sceneAdapter.test.ts` (existing file — append)

**Contract** (from `src/core/adapters/types.ts`, already declared — implement, don't change):
- `snapshotSelection(ids)` → `ClipboardSnapshot` (`{ items: TNode[] }`). Dedupe ids whose ancestor is also selected (use `scene.ancestorsOf`). For each surviving root, capture the node and its full subtree DFS **parents-before-children**, as adapter-shaped node objects (same shape `getNode` returns / `insertNode` consumes — read those two functions first and mirror their field mapping exactly, including `parent` and container `children`). Deep-copy poses/data (spread; children arrays copied).
- `commitPaste(clipboard, offset, ctx?)` → `TNode[]`: mint fresh ids for every item (scene's `generateId` isn't adapter-reachable — use the same id style `insertNode` tolerates: a `paste-`-prefixed unique id via a module counter + random suffix, mirroring `defaultGenerateId`'s shape), remap `parent` references internal to the snapshot onto the fresh ids (items whose parent isn't in the snapshot become roots: `parent: null`), apply `offset` (and `ctx?.dropPoint` cluster-origin policy if trivially expressible — otherwise offset only, matching the hook's fallback) to **root** poses only (descendants ride along via relative poses). Return the new nodes parents-before-children. **Do NOT insert** — `useClipboardOps.paste` builds `createInsertOp` per node and dispatches; insertion through ops is what makes paste one undo entry.
- `getPasteOffset(clipboard)` → cascade `{ dx: 12, dy: 12 }` (constant; the hook re-snapshots created items so repeated pastes cascade).

- [ ] **Step 1 (red):** append a `describe('clipboard seam', ...)` to `sceneAdapter.test.ts`: snapshot of a leaf captures pose+data copy (mutating the snapshot doesn't mutate the scene); snapshot of a selected container captures the subtree parents-first and deduping a selected child of a selected container; commitPaste mints fresh ids (disjoint from originals), remaps children's `parent` to the fresh container id, offsets only roots; a paste round-trip through `useClipboardOps` (adapter + hook together: copy → paste → scene contains the new subtree, one undo entry, selection = new ids — mirror how existing sceneAdapter tests construct scene+adapter). Run: FAIL (methods undefined).
- [ ] **Step 2:** implement on the adapter object in `sceneAdapter.ts`, following its existing code style. Run to green: `npx vitest run --project=kit src/canvas`.
- [ ] **Step 3:** `npm run typecheck`; commit `feat(canvas): implement the adapter clipboard seam (snapshotSelection/commitPaste/getPasteOffset)`.

---

### Task 2: Migrate draw onto `useClipboardOps`

**Files:** Modify `apps/draw/src/App.tsx`

- [ ] **Step 1:** In the component holding the hand-rolled clipboard (App.tsx ~547–602): replace `clipboardRef`/`snapshotSelection`/`onCopy`/`onCut`/`onPaste` with:

```ts
  const clipboard = useClipboardOps(adapter, {
    getSelection: () => selection.current as string[],
    onPaste: (ids) => selection.set(ids.map(asNodeId)),
  });
  const onCopy = useCallback(() => { clipboard.copy(); setClipboardEmpty(clipboard.isEmpty()); }, [clipboard]);
  const onCut = useCallback(() => {
    clipboard.copy();
    if (clipboard.isEmpty()) return;
    setClipboardEmpty(false);
    scene.batch('Cut', () => {
      for (const id of selection.current) scene.remove(asNodeId(id));
    });
  }, [clipboard, scene, selection]);
  const onPaste = useCallback(() => { clipboard.paste(); }, [clipboard]);
```

  (`adapter` must be the canvas adapter in that component's scope — locate how it's obtained there (`useSceneAdapter(scene, {})` exists in a nearby component; if this component lacks one, create it the same way). `useClipboardOps` is exported from the kit barrel. Preserve the existing `clipboardEmpty` UI state semantics — set it from `clipboard.isEmpty()` after copy/cut; paste leaves it false, matching today.)

- [ ] **Step 2:** Delete the now-dead hand-rolled code and its "kit actions weren't wired" comment. `npx vitest run --project=draw` green; `npm run typecheck` clean. Manual sanity is deferred to Task 6's smoke (which now also exercises group copy — previously impossible).
- [ ] **Step 3:** Commit `refactor(draw): replace hand-rolled clipboard with the kit clipboard seam`.

---

### Task 3: Wire format + outbound flavor seam

**Files:** Create `src/interactions/actions/clipboard/wireFormat.ts` + `wireFormat.test.ts`; Modify `clipboardOps.ts` + create `clipboardOps.test.ts`; Modify `clipboard/index.ts`, `src/index.ts`

- [ ] **Step 1 (red):** `wireFormat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { WEASEL_CLIPBOARD_MIME, buildWeaselClipboardText, sniffWeaselClipboardText, parseWeaselClipboardText } from './wireFormat';

describe('weasel clipboard wire format', () => {
  it('round-trips items through build/parse', () => {
    const items = [{ id: 'a', pose: { x: 1 }, data: { fill: '#fff' } }];
    const text = buildWeaselClipboardText(items);
    expect(sniffWeaselClipboardText(text)).toBe(true);
    expect(parseWeaselClipboardText(text)).toEqual(items);
  });

  it('applies replacer and reviver', () => {
    const items = [{ id: 'a', buf: new Float32Array([1, 2]) }];
    const replacer = (_k: string, v: unknown) =>
      v instanceof Float32Array ? { $f32: Array.from(v) } : v;
    const reviver = (_k: string, v: unknown) =>
      v && typeof v === 'object' && '$f32' in (v as object)
        ? new Float32Array((v as { $f32: number[] }).$f32) : v;
    const text = buildWeaselClipboardText(items, replacer);
    const out = parseWeaselClipboardText(text, reviver) as Array<{ buf: Float32Array }>;
    expect(out[0].buf).toBeInstanceOf(Float32Array);
    expect(Array.from(out[0].buf)).toEqual([1, 2]);
  });

  it('sniff rejects near-misses', () => {
    expect(sniffWeaselClipboardText('{"nodes":[]}')).toBe(false);              // no marker
    expect(sniffWeaselClipboardText('the word weaselClipboard in prose')).toBe(false); // not JSON
    expect(sniffWeaselClipboardText('{"weaselClipboard":2,"nodes":[]}')).toBe(false);  // wrong version
    expect(parseWeaselClipboardText('{"weaselClipboard":1}')).toBeNull();      // nodes missing
  });
});
```

- [ ] **Step 2:** implement `wireFormat.ts`:

```ts
import { dwarn } from 'debug/flag';

export const WEASEL_CLIPBOARD_MIME = 'application/x-weasel-clipboard+json';
/** Chromium's async-clipboard spelling for custom formats. */
export const WEASEL_CLIPBOARD_MIME_WEB = `web ${WEASEL_CLIPBOARD_MIME}`;

interface WeaselClipboardPayload { weaselClipboard: 1; nodes: unknown[] }

type Replacer = (key: string, value: unknown) => unknown;
type Reviver = (key: string, value: unknown) => unknown;

/** Serialize snapshot items into the versioned wire text. */
export function buildWeaselClipboardText(items: unknown[], replacer?: Replacer): string {
  const payload: WeaselClipboardPayload = { weaselClipboard: 1, nodes: items };
  return JSON.stringify(payload, replacer as Parameters<typeof JSON.stringify>[1]);
}

/** Cheap check: could this text be a weasel clipboard payload? Substring
 *  pre-check, then a guarded parse + marker/version test. */
export function sniffWeaselClipboardText(text: string): boolean {
  if (!text.includes('"weaselClipboard"')) return false;
  try {
    const parsed = JSON.parse(text) as Partial<WeaselClipboardPayload> | null;
    return !!parsed && parsed.weaselClipboard === 1;
  } catch {
    return false;
  }
}

/** Parse wire text to snapshot items, or null when malformed/mismatched
 *  (callers decline to the next content handler). */
export function parseWeaselClipboardText(text: string, reviver?: Reviver): unknown[] | null {
  try {
    const parsed = JSON.parse(text, reviver as Parameters<typeof JSON.parse>[1]) as
      Partial<WeaselClipboardPayload> | null;
    if (!parsed || parsed.weaselClipboard !== 1 || !Array.isArray(parsed.nodes)) return null;
    return parsed.nodes;
  } catch (err) {
    dwarn('clipboard', `weasel payload failed to parse: ${String(err)}`);
    return null;
  }
}
```

  (Add `clipboard` to `src/debug/flag.ts`'s known-namespace list.)

- [ ] **Step 3 (red):** `clipboardOps.test.ts` — jsdom tests with a stubbed `navigator.clipboard` (assign `Object.assign(navigator, { clipboard: { write: vi.fn() } })` per test, restore after; stub a minimal `ClipboardItem` on `globalThis` if jsdom lacks it — a class capturing its constructor arg suffices). Cases: (a) copy with default flavors calls `write` once with an item whose types include the web-prefixed custom MIME AND `text/plain`, both carrying `buildWeaselClipboardText` output; (b) first `write` rejection retries with standard-only flavors then resolves (spy call count 2, second call lacks the custom type); (c) both rejections → no throw, in-memory paste still works; (d) `navigator.clipboard` absent → no throw; (e) `produceFlavors` override replaces the map entirely; empty object → `write` never called; (f) `jsonReplacer` reaches the default flavor builder. Drive copy/paste through `useClipboardOps` with a stub adapter (`snapshotSelection` returning one item) via `renderHook` (match the project's existing hook-test pattern — grep for `renderHook` under `src/`).
- [ ] **Step 4:** implement in `clipboardOps.ts`: new options exactly as the spec §2 declares (`produceFlavors`, `jsonReplacer` with the spec's doc comments); `copy()` keeps its current body then appends the fire-and-forget ladder:

```ts
    // Best-effort OS write. Never blocks or throws — the in-memory ref is
    // already set, and OS clipboard support varies (custom formats are
    // Chromium-only via the "web " prefix; jsdom/non-secure contexts have
    // no API at all).
    const flavors = optsRef.current.produceFlavors?.(clipboardRef.current)
      ?? defaultFlavors(clipboardRef.current, optsRef.current.jsonReplacer);
    void writeOsClipboard(flavors);
```

  with module-level helpers:

```ts
function defaultFlavors(snapshot: ClipboardSnapshot, replacer?: Replacer): Record<string, string> {
  const text = buildWeaselClipboardText(snapshot.items, replacer);
  return { [WEASEL_CLIPBOARD_MIME]: text, 'text/plain': text };
}

/** Degradation ladder: full map (custom MIME web-prefixed) → standard-only
 *  → give up with a dwarn. Exported for tests. */
async function writeOsClipboard(flavors: Record<string, string>): Promise<void> {
  const entries = Object.entries(flavors);
  if (entries.length === 0) return;
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb?.write || typeof ClipboardItem === 'undefined') return;
  const toItem = (fs: [string, string][]) => new ClipboardItem(Object.fromEntries(
    fs.map(([mime, text]) => [
      mime === WEASEL_CLIPBOARD_MIME ? WEASEL_CLIPBOARD_MIME_WEB : mime,
      new Blob([text], { type: mime === WEASEL_CLIPBOARD_MIME ? WEASEL_CLIPBOARD_MIME_WEB : mime }),
    ]),
  ));
  try {
    await cb.write([toItem(entries)]);
  } catch {
    const standard = entries.filter(([mime]) => mime !== WEASEL_CLIPBOARD_MIME);
    if (standard.length === 0) { dwarn('clipboard', 'OS write failed; no standard flavors to fall back to'); return; }
    try {
      await cb.write([toItem(standard)]);
    } catch (err) {
      dwarn('clipboard', `OS clipboard write failed twice — copy stays in-memory only: ${String(err)}`);
    }
  }
}
```

  (Exact export shape for testability — e.g. exporting `writeOsClipboard`/`defaultFlavors` with a `/** @internal test seam */` tag or routing tests through the hook — implementer's choice, but tests must exercise the ladder through the public `copy()` at least once.) Re-export `WEASEL_CLIPBOARD_MIME` and the wire helpers from `clipboard/index.ts` and the kit barrel `src/index.ts` (consumers writing `produceFlavors` need them).
- [ ] **Step 5:** green: `npx vitest run --project=kit src/interactions/actions/clipboard`; `npm run typecheck`. Commit `feat(clipboard): OS flavor seam with weasel JSON wire format`.

---

### Task 4: Inbound handler + ctx plumbing

**Files:** Create `src/features/ingestion/weaselJsonHandler.ts` + test; Modify `contentHandlers.ts` (IngestCtx), `registerKitHandlers.ts`, `SceneCanvas.tsx`, `useGestureDispatcher.tsx`

- [ ] **Step 1:** `IngestCtx` gains (documented like its siblings):

```ts
  /** Clipboard-paste seam — present when the hosting `SceneCanvas` supplied
   *  an adapter with `commitPaste`. `reviver` comes from
   *  `SceneCanvasProps.ingestion.clipboard`. Absent ⇒ the kit weasel-JSON
   *  handler declines and other handlers get their shot. */
  clipboard?: {
    adapter: InsertAdapter<{ id: string }>;
    reviver?: (key: string, value: unknown) => unknown;
  };
```

  `SceneCanvasProps.ingestion` gains `clipboard?: { reviver?: (key: string, value: unknown) => unknown; enabled?: boolean }` (default enabled). Thread both through the same path `ingestion.svg` already travels (SceneCanvas → dispatcher props → the `IngestCtx` construction site — find it by grepping `svg:` in `useGestureDispatcher.tsx`; the canvas adapter instance is available where SceneCanvas builds its deps — pass THAT adapter, `enabled: false` omits the member).

- [ ] **Step 2 (red):** handler test (mirror `svgHandler`/`imageHandler` test structure — read one first): matching (custom MIME, `web `-prefixed MIME, sniffed text/plain; non-weasel text/plain declines), a full paste (ctx with a stub adapter whose `commitPaste` returns minted nodes → `ctx.applyOps` called once with insert ops + a selection op, selection set), corrupt payload → handler returns without acting (and the item stays available to later handlers per `runIngest` semantics — assert via a second lower-priority spy handler), missing `ctx.clipboard` → declines.
- [ ] **Step 3:** implement `weaselJsonHandler.ts`:

```ts
export const kitWeaselJsonHandler: ContentHandlerEntry = {
  id: 'kit:weasel-json',
  // Above the other kit handlers (-100) so weasel payloads never fall through
  // to the SVG/text paths; still below consumer handlers (default 0).
  priority: -50,
  match: (item) =>
    item.mime === WEASEL_CLIPBOARD_MIME
    || item.mime === WEASEL_CLIPBOARD_MIME_WEB
    || (item.mime === 'text/plain' && typeof item.text === 'string' && sniffWeaselClipboardText(item.text)),
  handle(items, ctx) { /* parse first matching item; decline (return) on null parse
    or missing ctx.clipboard/commitPaste with a dwarn; else reconstruct
    { items: nodes } snapshot, offset = adapter.getPasteOffset?.() ?? {dx:0,dy:0},
    created = adapter.commitPaste(snapshot, offset), build createInsertOp per
    created node + createSetSelectionOp(from ctx.selection.get(), to new ids),
    ctx.applyOps(ops, 'Paste'), ctx.selection.set(newIds). Mirror
    useClipboardOps.paste's op construction exactly (same imports). */ },
};
```

  (The `IngestItem` text/bytes access pattern: read `ingestItems.ts` for the actual field — string flavors carry text synchronously.) Register in `registerKitHandlers.ts`'s array. Consume the handled item so lower handlers don't double-ingest — read `runIngest`'s consumption semantics first and follow them.
- [ ] **Step 4:** green: `npx vitest run --project=kit src/features/ingestion src/canvas`; `npm run typecheck`; full `npm test` (dispatcher plumbing touches everything). Commit `feat(ingestion): weasel-JSON clipboard handler + SceneCanvas clipboard ctx`.

---

### Task 5: Draw flavor override (SVG out)

**Files:** Modify `apps/draw/src/svgInterop.ts`, `apps/draw/src/App.tsx`; Test in draw's existing test conventions

- [ ] **Step 1:** `sceneToSvgNodes(source)` gains an optional second parameter `roots?: string[]` — when supplied, walk exactly those ids (in the given order) instead of `source.roots`; whole-scene behavior byte-identical when omitted. Red-first test in draw's svg tests: subset walk emits only the requested subtree, matching the full walk's output for those nodes.
- [ ] **Step 2:** In App.tsx, build the override where the clipboard hook now lives:

```ts
  const produceFlavors = useCallback((snapshot: ClipboardSnapshot) => {
    const json = buildWeaselClipboardText(snapshot.items, serializeReplacer);
    const svg = selectionToSvgString(scene, snapshot.items.map((n) => (n as { id: string }).id));
    return {
      [WEASEL_CLIPBOARD_MIME]: json,
      'image/svg+xml': svg,
      // External design tools sniff text/plain for SVG markup; the JSON
      // rides the custom MIME (and cross-tab clipboardData) instead.
      'text/plain': svg,
    };
  }, [scene]);
```

  with `selectionToSvgString` added next to `sceneToSvgString` in draw's svg modules: same `SceneSource`/serialize plumbing but `sceneToSvgNodes(source, ids)` and a viewBox fitted to the selection bounds (reuse whatever bounds helper `svgExport.ts` uses; if it's page-fitted only, compute from the walked nodes' poses). **Wrinkle:** `snapshot.items` are adapter-shaped copies, not live scene nodes — but their ids are the ORIGINAL ids at copy time, so walking the live scene by those ids is correct at copy time. Pass the override + `jsonReplacer: serializeReplacer` into `useClipboardOps`, and `ingestion={{ clipboard: { reviver: reviveTypedArrays } }}` (merged into the existing ingestion prop if present) on draw's `SceneCanvas`.
- [ ] **Step 3:** Red-first test for `selectionToSvgString` (parses via `@weasel-js/svg` `parseSvg`, contains only selected shapes). Green: `npx vitest run --project=draw`; `npm run typecheck`. Commit `feat(draw): SVG+JSON clipboard flavors via selection-subset export`.

---

### Task 6: Browser smoke, full gate, docs

- [ ] **Step 1 — smoke** (dev server + Playwright MCP, same pattern as the Phase 2a smoke; close pages + kill server after):
  1. Draw at localhost: clear localStorage, draw/select the starter rect, Cmd+C. Read back the OS clipboard **in page context** (`navigator.clipboard.read()` needs focus + permission — Playwright grants `clipboard-read` via context options; if permission wrangling stalls after 2-3 attempts, fall back to asserting through a paste round-trip instead of direct read) and record which flavor names actually landed (open question 2: note the custom MIME's observed spelling).
  2. Same tab: Cmd+V → a new offset rect appears (OS path or in-memory path both acceptable here).
  3. **Cross-reload proof:** reload (in-memory ref gone), Cmd+V → the copied rect still pastes (OS payload → ingestion handler). This is the deliverable's headline behavior.
  4. Group copy: group two rects (Cmd+G), copy, paste → a group pastes (Task 1+2's structural win).
  5. Paste external SVG text (set clipboard to a small `<svg>` doc via the page) → still ingests through the kit SVG handler (no regression from the new higher-priority handler).
  6. Record concrete evidence (node counts, flavor lists) — no faked claims; report exactly what couldn't be verified if the browser fights back.
- [ ] **Step 2 — gate:** `npm run typecheck && npm test && npm run build`, warnings surfaced verbatim.
- [ ] **Step 3 — docs:** `docs/TODO.md`: rewrite the "(P2) Clipboard: OS clipboard / cross-reload serialization" bullet as done (date, spec pointer, one-line surface summary: adapter seam + `produceFlavors` + `kit:weasel-json` handler + draw SVG flavors; note the draw hand-rolled-clipboard migration and that imperative paste buttons remain in-memory by design). Update the quick-index Clipboard line (~41) to done. Update the coalescing quick-index line (~40) to drop "Phase 2b pending" (now shipped). Commit docs; then final whole-branch review; then superpowers:finishing-a-development-branch.

---

## Self-review notes

- Spec §1 wire format → Task 3 (`wireFormat.ts`, sniff near-miss tests). §2 outbound seam + ladder → Task 3. §3 inbound handler + ctx + SceneCanvas knobs → Task 4 (priority −50 beats kit handlers, loses to consumers — matches the registry's documented convention). §4 draw override incl. subset walk (open Q3 → `roots` param) → Task 5. §5 degradation → Tasks 3/4 tests. Corrections section (seam + migration) → Tasks 1–2. Testing section fully mapped; smoke covers cross-reload paste, group copy, external-SVG non-regression, and open Q2's empirical MIME check.
- Type consistency: `WEASEL_CLIPBOARD_MIME`/`_WEB`, `buildWeaselClipboardText`/`sniffWeaselClipboardText`/`parseWeaselClipboardText` used identically across Tasks 3–5; `IngestCtx.clipboard` shape declared once (Task 4) and consumed only there.
- Deliberate non-verbatim zones (Tasks 1, 2, 4 handler body, 5 bounds): contracts are fully specified but field-level code defers to named source-of-truth files; each such zone names exactly which file to read first.
