# External-Content Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OS file drop, system-clipboard paste, and a file-picker helper all converge on one MIME-keyed content-handler registry; the kit ships an `image/*` handler that inserts undoable image nodes.

**Architecture:** Drop and paste become gesture kinds in `@weasel-js/gestures`; `useGestureDispatcher` owns the DOM listeners and normalizes both into materialized `IngestItem[]` payloads; a kit-registered ambient `ingest` action routes items through a priority-ordered handler registry (`src/features/ingestion/`). The picker and `CanvasExtensionApi.ingest()` feed the same action imperatively via `ActionsRegistry.trigger`.

**Tech Stack:** TypeScript, React hooks, vitest (jsdom for unit; browser-mode visual tests run in CI only). Spec: `docs/superpowers/specs/2026-07-03-content-ingestion-design.md`.

**Conventions:** Run all commands from the repo root. `npx vitest run <path>` for tests. Commit after every green task. All paths below are repo-relative.

---

## File map

| File | Role |
|---|---|
| `packages/gestures/src/ui/inputEvent.ts` (modify) | `IngestItem`, `DropEvent`, `PasteEvent` arms |
| `packages/gestures/src/ui/spec.ts` (modify) | `DropSpec`, `PasteSpec` in `GestureSpec` |
| `packages/gestures/src/ui/match.ts` (modify) | `drop`/`paste` cases + MIME-glob matcher |
| `packages/gestures/src/index.ts` (modify) | export new types |
| `src/interactions/gestures/spec.ts` (modify) | kit re-export of the new spec types |
| `src/features/ingestion/ingestItems.ts` (create) | DataTransfer/ClipboardData → `IngestItem[]` materialization |
| `src/features/ingestion/contentHandlers.ts` (create) | handler registry + partition + `runIngest` |
| `src/features/ingestion/imageHandler.ts` (create) | kit `image/*` handler (embed / `resolveSrc`, measure, insert) |
| `src/features/ingestion/openFilePicker.ts` (create) | file-picker DOM helper |
| `src/features/ingestion/index.ts` (create) | feature barrel |
| `src/interactions/actions/depSchema.ts` (modify) | `IngestionDep` (`viewportWorldRect`, `resolveSrc`) |
| `src/canvas/deps/ingestion.ts` (create) | `useIngestionDepSource` |
| `src/canvas/deps/index.ts` (modify) | export it |
| `src/interactions/actions/defaults/ingest.ts` (create) | the `ingest` action |
| `src/interactions/actions/useStandardActions.ts` (modify) | register `ingestAction` |
| `src/interactions/dispatcher/dispatcher.ts` (modify) | merge drop/paste event data into immediate params |
| `src/interactions/dispatcher/useGestureDispatcher.tsx` (modify) | drop/dragover/dragleave/paste listeners + `weasel-dropover` class |
| `src/interactions/actions/registry.tsx` (modify) | `trigger()` builds deps from `requires` |
| `src/canvas/SceneCanvas.tsx` (modify) | `ingestion` prop; `ingest()` on the ref handle |
| `src/canvas/canvasExtension.ts` (modify) | `CanvasExtensionApi.ingest` |
| `src/index.ts` (modify) | public exports |
| `apps/site/demos/IngestionDemo.tsx` (create) + `apps/site/registry.ts` + `apps/site/canvas-kit-demo.css` (modify) | demo |
| `docs/taxonomy.md`, `docs/TODO.md` (modify) | docs |

---

### Task 1: Gesture vocabulary — `IngestItem`, drop/paste events + specs, matcher

**Files:**
- Modify: `packages/gestures/src/ui/inputEvent.ts`
- Modify: `packages/gestures/src/ui/spec.ts`
- Modify: `packages/gestures/src/ui/match.ts`
- Modify: `packages/gestures/src/index.ts`
- Modify: `src/interactions/gestures/spec.ts`
- Test: `packages/gestures/src/ui/match.test.ts` (append)

- [ ] **Step 1: Write the failing matcher tests**

Append to `packages/gestures/src/ui/match.test.ts` (follow the file's existing `describe`/`it` style and its `matchSpec` import):

```ts
describe('matchSpec — drop / paste', () => {
  const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
  const png = { kind: 'file' as const, mime: 'image/png', file: {} as File };
  const txt = { kind: 'string' as const, mime: 'text/plain', text: 'hi' };

  it('drop spec matches a drop event', () => {
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop' }, false)).toBe(true);
  });

  it('drop spec does not match a paste event (and vice versa)', () => {
    expect(matchSpec({ kind: 'paste', items: [png], ...mods }, { kind: 'drop' }, false)).toBe(false);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'paste' }, false)).toBe(false);
  });

  it('types filters by MIME glob — any item matching any glob', () => {
    expect(matchSpec({ kind: 'drop', items: [txt], ...mods }, { kind: 'drop', types: ['image/*'] }, false)).toBe(false);
    expect(matchSpec({ kind: 'drop', items: [txt, png], ...mods }, { kind: 'drop', types: ['image/*'] }, false)).toBe(true);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop', types: ['image/png'] }, false)).toBe(true);
    expect(matchSpec({ kind: 'drop', items: [png], ...mods }, { kind: 'drop', types: ['image/jpeg'] }, false)).toBe(false);
  });

  it('paste spec honors mods', () => {
    const shifted = { ...mods, shiftKey: true };
    expect(matchSpec({ kind: 'paste', items: [png], ...shifted }, { kind: 'paste' }, false)).toBe(false);
    expect(matchSpec({ kind: 'paste', items: [png], ...shifted }, { kind: 'paste', mods: { shift: true } }, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/gestures/src/ui/match.test.ts`
Expected: FAIL — TS errors ('drop' not assignable to `GestureSpec['kind']` / `InputEvent`).

- [ ] **Step 3: Add `IngestItem` + event arms to `inputEvent.ts`**

Insert before the `InputEvent` union in `packages/gestures/src/ui/inputEvent.ts`:

```ts
/**
 * One piece of external content arriving via OS drop, clipboard paste, or a
 * file picker — fully materialized (string contents already read), so it is
 * safe to hold past the originating DOM event. `File` is a lib.dom type;
 * no runtime DOM dependency.
 */
export type IngestItem =
  | { kind: 'file'; mime: string; file: File }
  | { kind: 'string'; mime: string; text: string };

/** External content dropped onto the canvas (OS drag-and-drop). */
export interface DropEvent extends EventModifiers {
  kind: 'drop';
  items: readonly IngestItem[];
  /** World-space drop point (post view transform). */
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
}

/** External content pasted from the system clipboard. Carries no point. */
export interface PasteEvent extends EventModifiers {
  kind: 'paste';
  items: readonly IngestItem[];
}
```

Add `| DropEvent | PasteEvent` to the `InputEvent` union.

- [ ] **Step 4: Add `DropSpec` / `PasteSpec` to `spec.ts`**

Insert before the `GestureSpec` union in `packages/gestures/src/ui/spec.ts`:

```ts
/** OS drag-and-drop of external content onto the canvas. `types` filters by
 *  MIME glob (`'image/*'`, `'text/plain'`); the spec matches when ANY item's
 *  MIME matches ANY glob. Omitted = matches any drop. */
export interface DropSpec {
  kind: 'drop';
  types?: string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}

/** System-clipboard paste of external content. Same `types` semantics as
 *  {@link DropSpec}. */
export interface PasteSpec {
  kind: 'paste';
  types?: string[];
  mods?: ModSpec;
  phase?: PhaseSpec;
}
```

Add `| DropSpec | PasteSpec` to the `GestureSpec` union.

- [ ] **Step 5: Add matcher cases to `match.ts`**

Add a module-level helper (near the other small helpers in `packages/gestures/src/ui/match.ts`):

```ts
/** MIME-glob match: `'image/*'` prefix-matches the major type; anything
 *  else is an exact (case-insensitive) match; bare `'*'` matches all. */
function mimeMatchesGlob(mime: string, glob: string): boolean {
  const m = mime.toLowerCase();
  const g = glob.toLowerCase();
  if (g === '*' || g === '*/*') return true;
  if (g.endsWith('/*')) return m.startsWith(g.slice(0, -1));
  return m === g;
}

function matchIngestTypes(
  items: readonly { mime: string }[],
  types: string[] | undefined,
): boolean {
  if (!types || types.length === 0) return true;
  return items.some((it) => types.some((g) => mimeMatchesGlob(it.mime, g)));
}
```

Add to the `switch (spec.kind)` in `matchSpec` (before the `default`):

```ts
    case 'drop': {
      if (e.kind !== 'drop') return false;
      if (!matchIngestTypes(e.items, spec.types)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'paste': {
      if (e.kind !== 'paste') return false;
      if (!matchIngestTypes(e.items, spec.types)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }
```

- [ ] **Step 6: Export from the package + kit barrels**

In `packages/gestures/src/index.ts`, add `DropEvent`, `PasteEvent`, `IngestItem` to the `./ui/inputEvent` type-export block and `DropSpec`, `PasteSpec` to the `./ui/spec` block. In `src/interactions/gestures/spec.ts`, add `DropSpec` and `PasteSpec` to the re-export list.

- [ ] **Step 7: Run tests**

Run: `npx vitest run packages/gestures/src/ui/match.test.ts packages/gestures/src/ui/spec.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add packages/gestures/src src/interactions/gestures/spec.ts
git commit -m "feat(gestures): drop + paste join the gesture vocabulary (IngestItem payloads, MIME-glob specs)"
```

---

### Task 2: `IngestItem` materialization from DOM events

**Files:**
- Create: `src/features/ingestion/ingestItems.ts`
- Test: `src/features/ingestion/ingestItems.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/ingestion/ingestItems.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { itemsFromDataTransfer, itemsFromClipboardData } from './ingestItems';

/** Minimal DataTransferItem stand-in (jsdom has no DataTransfer constructor). */
function fileItem(name: string, type: string) {
  const file = new File(['x'], name, { type });
  return { kind: 'file' as const, type, getAsFile: () => file, getAsString: () => {} };
}
function stringItem(type: string, text: string) {
  return {
    kind: 'string' as const, type,
    getAsFile: () => null,
    getAsString: (cb: (s: string) => void) => setTimeout(() => cb(text), 0),
  };
}
function dt(items: unknown[], files: File[] = []) {
  return { items, files } as unknown as DataTransfer;
}

describe('itemsFromDataTransfer', () => {
  it('materializes files and strings (strings read async)', async () => {
    const out = await itemsFromDataTransfer(dt([
      fileItem('a.png', 'image/png'),
      stringItem('text/plain', 'hello'),
    ]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'file', mime: 'image/png' });
    expect(out[1]).toMatchObject({ kind: 'string', mime: 'text/plain', text: 'hello' });
  });

  it('ignores string flavors outside the supported set', async () => {
    const out = await itemsFromDataTransfer(dt([stringItem('application/x-moz-custom', 'x')]));
    expect(out).toHaveLength(0);
  });

  it('falls back to dataTransfer.files when items is empty', async () => {
    const f = new File(['x'], 'b.jpg', { type: 'image/jpeg' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out).toEqual([{ kind: 'file', mime: 'image/jpeg', file: f }]);
  });

  it('defaults a missing file MIME to application/octet-stream', async () => {
    const f = new File(['x'], 'noext', { type: '' });
    const out = await itemsFromDataTransfer(dt([], [f]));
    expect(out[0]).toMatchObject({ mime: 'application/octet-stream' });
  });
});

describe('itemsFromClipboardData', () => {
  it('reads files and text flavors synchronously', () => {
    const f = new File(['x'], 'c.png', { type: 'image/png' });
    const cd = {
      files: [f],
      getData: (t: string) => (t === 'text/plain' ? 'pasted' : ''),
    } as unknown as DataTransfer;
    const out = itemsFromClipboardData(cd);
    expect(out).toEqual([
      { kind: 'file', mime: 'image/png', file: f },
      { kind: 'string', mime: 'text/plain', text: 'pasted' },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/ingestion/ingestItems.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/ingestion/ingestItems.ts`:

```ts
/**
 * IngestItem materialization — turns a live `DataTransfer` (drop) or
 * clipboard `DataTransfer` (paste) into fully-owned `IngestItem[]`.
 *
 * `DataTransfer` items are only readable while the originating DOM event is
 * on the stack, so BOTH functions must be called synchronously from the event
 * handler. `itemsFromDataTransfer` kicks off every `getAsString` read
 * immediately and resolves once all strings are collected;
 * `itemsFromClipboardData` is fully synchronous (`getData` + `files`).
 */
import type { IngestItem } from '@weasel-js/gestures';

export type { IngestItem };

/** The string flavors the kit normalizes. Everything else (browser-internal
 *  custom flavors, etc.) is dropped at materialization. */
export const INGEST_STRING_MIMES: ReadonlySet<string> = new Set([
  'text/plain',
  'text/html',
  'text/uri-list',
]);

const FALLBACK_MIME = 'application/octet-stream';

/** Materialize a drop's `DataTransfer`. MUST be called during the `drop`
 *  event dispatch (see module doc). */
export function itemsFromDataTransfer(dt: DataTransfer): Promise<IngestItem[]> {
  const files: IngestItem[] = [];
  const strings: IngestItem[] = [];
  const reads: Promise<void>[] = [];

  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push({ kind: 'file', mime: file.type || FALLBACK_MIME, file });
    } else if (item.kind === 'string' && INGEST_STRING_MIMES.has(item.type)) {
      const mime = item.type;
      reads.push(
        new Promise((resolve) => {
          item.getAsString((text) => {
            strings.push({ kind: 'string', mime, text });
            resolve();
          });
        }),
      );
    }
  }

  // Some sources populate `files` without `items` (older engines, jsdom).
  if (files.length === 0 && reads.length === 0) {
    for (const file of Array.from(dt.files ?? [])) {
      files.push({ kind: 'file', mime: file.type || FALLBACK_MIME, file });
    }
  }

  return Promise.all(reads).then(() => [...files, ...strings]);
}

/** Materialize a paste's `clipboardData`. Fully synchronous. */
export function itemsFromClipboardData(cd: DataTransfer): IngestItem[] {
  const out: IngestItem[] = [];
  for (const file of Array.from(cd.files ?? [])) {
    out.push({ kind: 'file', mime: file.type || FALLBACK_MIME, file });
  }
  for (const mime of INGEST_STRING_MIMES) {
    const text = cd.getData(mime);
    if (text) out.push({ kind: 'string', mime, text });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/ingestion/ingestItems.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ingestion
git commit -m "feat(ingestion): materialize IngestItems from DataTransfer / clipboardData"
```

---

### Task 3: Content-handler registry + `runIngest`

**Files:**
- Create: `src/features/ingestion/contentHandlers.ts`
- Test: `src/features/ingestion/contentHandlers.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/ingestion/contentHandlers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerContentHandler,
  getContentHandlers,
  runIngest,
  _resetContentHandlersForTests,
  type IngestCtx,
} from './contentHandlers';
import type { IngestItem } from './ingestItems';

const png: IngestItem = { kind: 'file', mime: 'image/png', file: new File(['x'], 'a.png', { type: 'image/png' }) };
const csv: IngestItem = { kind: 'file', mime: 'text/csv', file: new File(['x'], 'a.csv', { type: 'text/csv' }) };
const txt: IngestItem = { kind: 'string', mime: 'text/plain', text: 'hi' };

const ctx = { point: null } as unknown as IngestCtx;

beforeEach(() => _resetContentHandlersForTests());
afterEach(() => vi.restoreAllMocks());

describe('registerContentHandler', () => {
  it('returns a disposer that removes the entry', () => {
    const off = registerContentHandler({ id: 't', match: 'text/plain', handle: () => {} });
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(true);
    off();
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(false);
  });
});

describe('runIngest', () => {
  it('partitions items across handlers by priority; first match takes its items', async () => {
    const img = vi.fn();
    const rest = vi.fn();
    registerContentHandler({ id: 'img', match: 'image/*', priority: 10, handle: img });
    registerContentHandler({ id: 'any', match: () => true, priority: 0, handle: rest });
    await runIngest([png, csv, txt], ctx);
    expect(img).toHaveBeenCalledWith([png], ctx);
    expect(rest).toHaveBeenCalledWith([csv, txt], ctx);
  });

  it('supports string[] and predicate match forms', async () => {
    const h = vi.fn();
    registerContentHandler({ id: 'multi', match: ['text/csv', 'text/plain'], handle: h });
    await runIngest([png, csv, txt], ctx);
    expect(h).toHaveBeenCalledWith([csv, txt], ctx);
  });

  it('a throwing handler warns and does not block others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = vi.fn();
    registerContentHandler({ id: 'boom', match: 'image/*', priority: 10, handle: () => { throw new Error('x'); } });
    registerContentHandler({ id: 'ok', match: 'text/plain', handle: ok });
    await runIngest([png, txt], ctx);
    expect(ok).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('a rejecting async handler warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerContentHandler({ id: 'rej', match: 'image/*', handle: async () => { throw new Error('x'); } });
    await runIngest([png], ctx);
    expect(warn).toHaveBeenCalled();
  });

  it('unmatched items are silently ignored (dwarn is debug-gated)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runIngest([txt], ctx); // no handlers registered
    expect(warn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/ingestion/contentHandlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/ingestion/contentHandlers.ts`:

```ts
/**
 * Content-handler registry — the "registry out" half of external-content
 * ingestion (spec: docs/superpowers/specs/2026-07-03-content-ingestion-design.md).
 *
 * All three arrival paths (OS drop, clipboard paste, file picker /
 * `CanvasExtensionApi.ingest`) converge here: the `ingest` action calls
 * `runIngest(items, ctx)`, which partitions the items across registered
 * handlers in priority order — the first matching handler takes every item
 * it matches; leftovers continue down the list. Same per-trait registry
 * idiom as `NodeShape` / `NodeRouting`.
 */
import { dwarn } from '../../debug';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { InsertDep, ActionDeps } from 'interactions/actions/depSchema';
import type { IngestItem } from './ingestItems';

/** Context handed to every content handler for one ingest event. */
export interface IngestCtx {
  /** World-space arrival point (drop / pointed imperative ingest); `null`
   *  for paste and point-less calls — handlers pick their own policy
   *  (the kit image handler centers on the viewport). */
  point: { x: number; y: number } | null;
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** The kit insert dep — id/layer/undoable-op supplied; the canonical way
   *  for a handler to mint a node (`insert.commit(bounds, { kind, ...})`). */
  insert: InsertDep;
  /** Raw op commit for handlers that build their own ops. */
  applyOps(ops: Op[], label?: string): void;
  scene: Scene<unknown, string, unknown>;
  selection: SelectionApi;
  /** Consumer file→src resolver (SceneCanvas `ingestion.resolveSrc`).
   *  When absent, the kit image handler embeds as a `data:` URI. */
  resolveSrc?: (file: File) => Promise<string>;
  /** Full action-deps bag, for consumer handlers that need more. */
  deps: ActionDeps;
}

export interface ContentHandlerEntry {
  /** Stable identifier — used for unregistration and debugging
   *  (`'kit:image'`, `'app:csv'`). */
  id: string;
  /** MIME glob(s) (`'image/*'`, `'text/csv'`) or an item predicate. */
  match: string | string[] | ((item: IngestItem) => boolean);
  /** Higher runs earlier. Kit defaults register at -100 so any consumer
   *  handler (default 0) beats them. */
  priority?: number;
  handle(items: IngestItem[], ctx: IngestCtx): void | Promise<void>;
}

const HANDLERS: ContentHandlerEntry[] = [];

/** Register a content handler. Returns a disposer that removes it. */
export function registerContentHandler(entry: ContentHandlerEntry): () => void {
  HANDLERS.push(entry);
  return () => {
    const i = HANDLERS.indexOf(entry);
    if (i >= 0) HANDLERS.splice(i, 1);
  };
}

/** Snapshot of registered handlers, priority-ordered (stable within ties). */
export function getContentHandlers(): readonly ContentHandlerEntry[] {
  return [...HANDLERS].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function mimeMatchesGlob(mime: string, glob: string): boolean {
  const m = mime.toLowerCase();
  const g = glob.toLowerCase();
  if (g === '*' || g === '*/*') return true;
  if (g.endsWith('/*')) return m.startsWith(g.slice(0, -1));
  return m === g;
}

function entryMatches(entry: ContentHandlerEntry, item: IngestItem): boolean {
  const { match } = entry;
  if (typeof match === 'function') return match(item);
  const globs = Array.isArray(match) ? match : [match];
  return globs.some((g) => mimeMatchesGlob(item.mime, g));
}

/**
 * Route one ingest event's items through the registry. Handlers run
 * concurrently (each already owns a disjoint item set); a throwing or
 * rejecting handler `console.warn`s and doesn't block the others.
 * Unmatched items are ignored with a debug-gated `dwarn('ingest', …)`.
 */
export async function runIngest(items: IngestItem[], ctx: IngestCtx): Promise<void> {
  let remaining = items;
  const runs: Promise<void>[] = [];

  for (const entry of getContentHandlers()) {
    if (remaining.length === 0) break;
    const mine = remaining.filter((it) => entryMatches(entry, it));
    if (mine.length === 0) continue;
    remaining = remaining.filter((it) => !mine.includes(it));
    runs.push(
      Promise.resolve()
        .then(() => entry.handle(mine, ctx))
        .catch((err) => {
          console.warn(`weasel ingest: handler "${entry.id}" threw`, err);
        }),
    );
  }

  if (remaining.length > 0) {
    dwarn(
      'ingest',
      `no content handler matched ${remaining.length} item(s):`,
      remaining.map((it) => it.mime).join(', '),
    );
  }

  await Promise.all(runs);
}

/** @internal test seam — clear the registry. Not part of the public barrel. */
export function _resetContentHandlersForTests(): void {
  HANDLERS.length = 0;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/features/ingestion/contentHandlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ingestion
git commit -m "feat(ingestion): content-handler registry — priority partition, error isolation, dwarn on unmatched"
```

---

### Task 4: `IngestionDep` + `useIngestionDepSource`

**Files:**
- Modify: `src/interactions/actions/depSchema.ts`
- Create: `src/canvas/deps/ingestion.ts`
- Modify: `src/canvas/deps/index.ts`
- Test: `src/canvas/deps/ingestion.test.tsx`

- [ ] **Step 1: Add `IngestionDep` to the dep schema**

In `src/interactions/actions/depSchema.ts`, add the interface near `InsertDep` and an `ingestion: IngestionDep;` line inside the `declare module` `DepSchema` block (match the existing entries' comment style):

```ts
/**
 * Dep for the `ingest` action (external-content ingestion).
 * Sourced from `<SceneCanvas>` / `<StandardActionsRegistrar>` via
 * `useIngestionDepSource` — canvas rect + current view.
 */
export interface IngestionDep {
  /** Visible canvas area in world coordinates. */
  viewportWorldRect(): { x: number; y: number; width: number; height: number };
  /** Consumer file→src resolver (from SceneCanvas's `ingestion` prop). */
  resolveSrc?: (file: File) => Promise<string>;
}
```

- [ ] **Step 2: Write the failing dep-source test**

`src/canvas/deps/ingestion.test.tsx` — follow the mounting pattern of an existing dep test (see `src/canvas/deps/insert.test.tsx` for the `DepRegistryProvider` + probe-component idiom):

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry } from 'interactions/actions/depRegistry';
import type { IngestionDep } from 'interactions/actions/depSchema';
import { useIngestionDepSource } from './ingestion';

function Probe({ out }: { out: { dep?: IngestionDep } }) {
  const reg = useDepRegistry();
  out.dep = reg.get('ingestion') as IngestionDep;
  return null;
}

function Host({ out, resolveSrc }: { out: { dep?: IngestionDep }; resolveSrc?: (f: File) => Promise<string> }) {
  const fakeCanvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  } as unknown as HTMLCanvasElement;
  useIngestionDepSource(
    { current: fakeCanvas },
    () => ({ x: 0, y: 0, scaleX: 2, scaleY: 2 }),
    resolveSrc,
  );
  return <Probe out={out} />;
}

describe('useIngestionDepSource', () => {
  it('viewportWorldRect maps the canvas rect through the view (scale 2 → half size)', () => {
    const out: { dep?: IngestionDep } = {};
    render(<DepRegistryProvider><Host out={out} /></DepRegistryProvider>);
    const rect = out.dep!.viewportWorldRect();
    expect(rect.width).toBeCloseTo(400);
    expect(rect.height).toBeCloseTo(300);
  });

  it('forwards resolveSrc', () => {
    const out: { dep?: IngestionDep } = {};
    const resolve = async () => 'x';
    render(<DepRegistryProvider><Host out={out} resolveSrc={resolve} /></DepRegistryProvider>);
    expect(out.dep!.resolveSrc).toBe(resolve);
  });
});
```

Adjust the `View` thunk shape to the actual `View` type (`src/core/viewport/` — `{ x, y, scaleX, scaleY }`; verify field names against `clientToWorld`'s signature before writing).

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/canvas/deps/ingestion.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the dep source**

`src/canvas/deps/ingestion.ts`:

```ts
/**
 * `useIngestionDepSource` — wires the `ingestion` dep consumed by
 * `ingestAction`. Computes the visible world rect from the canvas's client
 * rect + current view (same `clientToWorld` math the dispatcher uses), and
 * forwards the consumer's optional `resolveSrc`.
 */
import { useRef, type RefObject } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { IngestionDep } from 'interactions/actions/depSchema';
import { clientToWorld } from 'core/viewport/clientToWorld';
import type { View } from 'core/viewport/types';

export function useIngestionDepSource(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  getView: () => View,
  resolveSrc?: (file: File) => Promise<string>,
): void {
  const getViewRef = useRef(getView);
  getViewRef.current = getView;
  const resolveSrcRef = useRef(resolveSrc);
  resolveSrcRef.current = resolveSrc;

  useDepSource('ingestion', (): IngestionDep => ({
    viewportWorldRect() {
      const canvas = canvasRef.current;
      const view = getViewRef.current();
      if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
      const rect = canvas.getBoundingClientRect();
      const [x0, y0] = clientToWorld(rect.left, rect.top, rect, view);
      const [x1, y1] = clientToWorld(rect.left + rect.width, rect.top + rect.height, rect, view);
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    },
    resolveSrc: resolveSrcRef.current,
  }));
}
```

Verify `View`'s import path and `clientToWorld`'s exact signature (`src/core/viewport/clientToWorld.ts:24`) and adjust. Export from `src/canvas/deps/index.ts`:

```ts
export { useIngestionDepSource } from './ingestion';
```

- [ ] **Step 5: Run tests, commit**

Run: `npx vitest run src/canvas/deps/ingestion.test.tsx && npx tsc --noEmit`
Expected: PASS.

```bash
git add src/interactions/actions/depSchema.ts src/canvas/deps
git commit -m "feat(ingestion): IngestionDep (viewportWorldRect + resolveSrc) and its dep source"
```

---

### Task 5: The `ingest` action + dispatcher params merge

**Files:**
- Create: `src/interactions/actions/defaults/ingest.ts`
- Modify: `src/interactions/actions/useStandardActions.ts`
- Modify: `src/interactions/dispatcher/dispatcher.ts:770-778`
- Test: `src/interactions/actions/defaults/ingest.test.ts`

- [ ] **Step 1: Write the failing action test**

`src/interactions/actions/defaults/ingest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestAction } from './ingest';
import { registerContentHandler, _resetContentHandlersForTests } from 'features/ingestion/contentHandlers';
import type { IngestItem } from 'features/ingestion/ingestItems';

const png: IngestItem = { kind: 'file', mime: 'image/png', file: new File(['x'], 'a.png', { type: 'image/png' }) };

function deps() {
  return {
    scene: {} as never,
    selection: {} as never,
    insert: { commit: vi.fn() },
    applyOps: vi.fn(),
    ingestion: { viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }) },
  };
}

beforeEach(() => _resetContentHandlersForTests());

describe('ingestAction', () => {
  it('routes params.items through the handler registry with a point', async () => {
    const handle = vi.fn();
    registerContentHandler({ id: 't', match: 'image/*', handle });
    ingestAction.invoker!.timing === 'immediate' &&
      ingestAction.invoker!.run(deps() as never, { items: [png], worldX: 10, worldY: 20 });
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    const [items, ctx] = handle.mock.calls[0];
    expect(items).toEqual([png]);
    expect(ctx.point).toEqual({ x: 10, y: 20 });
  });

  it('point is null when the event carried none (paste)', async () => {
    const handle = vi.fn();
    registerContentHandler({ id: 't', match: 'image/*', handle });
    ingestAction.invoker!.timing === 'immediate' &&
      ingestAction.invoker!.run(deps() as never, { items: [png] });
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    expect(handle.mock.calls[0][1].point).toBeNull();
  });

  it('no-ops without items or without the ingestion dep', () => {
    expect(() => ingestAction.invoker!.timing === 'immediate' &&
      ingestAction.invoker!.run(deps() as never, undefined)).not.toThrow();
    expect(() => ingestAction.invoker!.timing === 'immediate' &&
      ingestAction.invoker!.run({} as never, { items: [png] })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/interactions/actions/defaults/ingest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the action**

`src/interactions/actions/defaults/ingest.ts`:

```ts
/**
 * @experimental
 * `ingest` — routes externally-arrived content (OS drop, clipboard paste,
 * file picker / `CanvasExtensionApi.ingest`) through the content-handler
 * registry (`features/ingestion/contentHandlers`).
 *
 * Registered ambient with both `drop` and `paste` default bindings, so
 * external content works regardless of the active tool. A tool can still
 * bind `{ kind: 'drop', types: [...] }` itself to intercept (active scope
 * beats ambient).
 *
 * The dispatcher merges event data into `params`: `items` (IngestItem[]),
 * plus `worldX`/`worldY` for drops. Absent coords → `point: null` and
 * handlers pick their own placement policy.
 */
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { Action } from '../registry';
import type { InsertDep, IngestionDep } from '../depSchema';
import { runIngest, type IngestCtx } from 'features/ingestion/contentHandlers';
import type { IngestItem } from 'features/ingestion/ingestItems';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

export const ingestAction: Action & { requires: string[] } = {
  id: 'ingest',
  label: 'Insert external content',
  defaultBinding: [{ kind: 'drop' }, { kind: 'paste' }],
  requires: ['scene', 'selection', 'insert', 'applyOps', 'ingestion'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const items = params?.items as IngestItem[] | undefined;
      if (!items || items.length === 0) return;
      const ingestion = deps.ingestion as IngestionDep | undefined;
      const insert = deps.insert as InsertDep | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const selection = deps.selection as SelectionApi | undefined;
      if (!ingestion || !insert || !scene || !selection) return;
      const applyOps = deps.applyOps as ((ops: Op[], label?: string) => void) | undefined;

      const point =
        typeof params?.worldX === 'number' && typeof params?.worldY === 'number'
          ? { x: params.worldX as number, y: params.worldY as number }
          : null;

      const ctx: IngestCtx = {
        point,
        viewportWorldRect: () => ingestion.viewportWorldRect(),
        insert,
        applyOps: (ops, label) => {
          if (applyOps) applyOps(ops, label);
          else scene.applyBatch(ops, label ?? 'Ingest', defaultCommitAdapter(scene));
        },
        scene,
        selection,
        resolveSrc: ingestion.resolveSrc,
        deps,
      };
      void runIngest(items, ctx);
    },
  },
  enabled: () => true,
};
```

- [ ] **Step 4: Register in `useStandardActions.ts`**

Add `import { ingestAction } from './defaults/ingest';` alongside the other default imports, append `ingestAction,` to `KIT_STANDARD_DESCRIPTORS`, and bump the descriptor-count comment above the array (47 → 48, amending the breakdown line with `+ 1 (ingest)`).

- [ ] **Step 5: Merge drop/paste event data into immediate params**

In `src/interactions/dispatcher/dispatcher.ts` (~line 770), extend the params-merge chain:

```ts
          } else if (event.kind === 'click' || event.kind === 'doubleclick') {
            params = {
              worldX: event.worldX,
              worldY: event.worldY,
              ...resolved,
            };
          } else if (event.kind === 'drop' || event.kind === 'paste') {
            // External-content events: forward the materialized items and,
            // for drops, the world-space arrival point.
            params = {
              items: event.items,
              via: event.kind,
              ...(event.kind === 'drop' && event.x !== undefined
                ? { worldX: event.x, worldY: event.y }
                : {}),
              ...resolved,
            };
          } else {
            params = resolved;
          }
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/interactions/actions/defaults/ingest.test.ts src/interactions/actions/useStandardActions.test.tsx src/interactions/dispatcher && npx tsc --noEmit`
Expected: PASS (the `useStandardActions` count test may assert the descriptor count — update it if it hardcodes 47).

- [ ] **Step 7: Commit**

```bash
git add src/interactions
git commit -m "feat(actions): ambient ingest action — drop/paste bindings route items to the content-handler registry"
```

---

### Task 6: Dispatcher DOM listeners — drop, dragover, paste

**Files:**
- Modify: `src/interactions/dispatcher/useGestureDispatcher.tsx`
- Test: `src/interactions/dispatcher/useGestureDispatcher.ingest.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/interactions/dispatcher/useGestureDispatcher.ingest.test.tsx` — model the harness on the existing `useGestureDispatcher.test.tsx` (it renders a hook host around a real `<canvas>` element and dispatches synthetic DOM events; reuse its provider/setup helpers):

```tsx
import { describe, it, expect, vi } from 'vitest';
// Reuse the harness idiom from useGestureDispatcher.test.tsx: an
// ActionsProvider + DepRegistryProvider host mounting useGestureDispatcher
// on a real <canvas>, with a registered test action.

describe('useGestureDispatcher — external-content ingestion', () => {
  it('drop on the canvas dispatches the bound action with items + world point', async () => {
    // - register action { id: 'ingest-probe', defaultBinding: [{ kind: 'drop' }],
    //     invoker: { timing: 'immediate', run: spy } }
    // - fire a DragEvent-like 'drop' on the canvas with a stubbed dataTransfer:
    //     { items: [], files: [new File(['x'], 'a.png', { type: 'image/png' })] }
    //   (jsdom has no DataTransfer/DragEvent constructor — construct an Event
    //   and assign `dataTransfer` before dispatch.)
    // - await vi.waitFor: spy called; params.items[0].mime === 'image/png';
    //   params.worldX/worldY are numbers.
  });

  it('dragover adds weasel-dropover; dragleave and drop remove it', () => {
    // fire dragover (with dataTransfer) → canvas.classList contains 'weasel-dropover'
    // fire dragleave → class removed; fire dragover + drop → class removed
  });

  it('paste dispatches with items and no point; editable targets are ignored', async () => {
    // - action bound to { kind: 'paste' }; fire ClipboardEvent-like 'paste' on window
    //   with clipboardData stub { files: [file], getData: () => '' }
    // - spy receives params.items, params.worldX undefined
    // - focus an <input>, fire paste with target=input → spy NOT called again
  });

  it('drop with an empty dataTransfer dispatches nothing', async () => {
    // dataTransfer { items: [], files: [] } → spy not called
  });
});
```

Flesh these out against the real harness helpers in `useGestureDispatcher.test.tsx` — the comments above are the required behaviors, not placeholders to skip; every bullet becomes real assertions.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/interactions/dispatcher/useGestureDispatcher.ingest.test.tsx`
Expected: FAIL — no drop/paste listeners exist yet (spy never called, class never added).

- [ ] **Step 3: Implement the listeners**

In `src/interactions/dispatcher/useGestureDispatcher.tsx`, add an import:

```ts
import { itemsFromDataTransfer, itemsFromClipboardData } from 'features/ingestion/ingestItems';
```

Add the handlers after `onContextMenu` (inside the main effect):

```ts
    // -----------------------------------------------------------------------
    // External-content ingestion: OS drop on the canvas, paste on window.
    // Items are materialized DURING the event (DataTransfer is only live on
    // the event stack); dispatch happens when materialization resolves.
    // -----------------------------------------------------------------------

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      // preventDefault is what makes the canvas a valid drop target.
      e.preventDefault();
      canvas?.classList.add('weasel-dropover');
    };

    const onDragLeave = () => {
      canvas?.classList.remove('weasel-dropover');
    };

    const onDrop = (e: DragEvent) => {
      canvas?.classList.remove('weasel-dropover');
      const dt = e.dataTransfer;
      if (!dt) return;
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      const base = {
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      void itemsFromDataTransfer(dt).then((items) => {
        if (items.length === 0) return;
        dispatch({
          kind: 'drop', items,
          x: w.x, y: w.y, clientX: e.clientX, clientY: e.clientY,
          ...base,
        });
      });
    };

    const onPaste = (e: ClipboardEvent) => {
      // Text-editing surfaces (inputs, the text-edit overlay) own their own
      // paste — never steal it for scene ingestion.
      if (isEditableTarget(e.target)) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const items = itemsFromClipboardData(cd);
      if (items.length === 0) return;
      e.preventDefault();
      dispatch({
        kind: 'paste', items,
        // ClipboardEvent carries no modifier state.
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      });
    };
```

Attach + clean up alongside the existing listeners:

```ts
    canvas?.addEventListener('dragover', onDragOver);
    canvas?.addEventListener('dragleave', onDragLeave);
    canvas?.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
```

and in the cleanup function:

```ts
      canvas?.removeEventListener('dragover', onDragOver);
      canvas?.removeEventListener('dragleave', onDragLeave);
      canvas?.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      canvas?.classList.remove('weasel-dropover');
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/interactions/dispatcher && npx tsc --noEmit`
Expected: PASS (existing dispatcher suites stay green).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/dispatcher
git commit -m "feat(dispatcher): drop + paste DOM channels — materialize items, dropover class, editable-target paste guard"
```

---

### Task 7: Kit `image/*` handler

**Files:**
- Create: `src/features/ingestion/imageHandler.ts`
- Test: `src/features/ingestion/imageHandler.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/ingestion/imageHandler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  kitImageHandler,
  __setImageMeasureForTests,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from './imageHandler';
import type { IngestCtx } from './contentHandlers';
import type { IngestItem } from './ingestItems';

const file = (name: string) => new File(['x'], name, { type: 'image/png' });
const item = (f: File): IngestItem => ({ kind: 'file', mime: 'image/png', file: f });

function ctx(overrides: Partial<IngestCtx> = {}): IngestCtx & { insert: { commit: ReturnType<typeof vi.fn> } } {
  return {
    point: null,
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    insert: { commit: vi.fn() },
    applyOps: vi.fn(),
    scene: {} as never,
    selection: {} as never,
    deps: {},
    ...overrides,
  } as never;
}

beforeEach(() => {
  _resetImageHandlerSeamsForTests();
  __setImageMeasureForTests(async () => ({ width: 400, height: 300 }));
  __setFileToDataUriForTests(async (f) => `data:image/png;base64,${f.name}`);
});

describe('kitImageHandler', () => {
  it('matches image/* files only', () => {
    const m = kitImageHandler.match as (i: IngestItem) => boolean;
    expect(m(item(file('a.png')))).toBe(true);
    expect(m({ kind: 'string', mime: 'image/svg+xml', text: '' })).toBe(false);
    expect(m({ kind: 'file', mime: 'text/csv', file: file('x') })).toBe(false);
  });

  it('inserts at natural size centered on point', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitImageHandler.handle([item(file('a.png'))], c);
    expect(c.insert.commit).toHaveBeenCalledWith(
      { x: -100, y: -50, width: 400, height: 300 },
      { kind: 'image', src: 'data:image/png;base64,a.png' },
    );
  });

  it('centers on the viewport when point is null', async () => {
    const c = ctx();
    await kitImageHandler.handle([item(file('a.png'))], c);
    const [bounds] = c.insert.commit.mock.calls[0];
    expect(bounds.x + bounds.width / 2).toBeCloseTo(400);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(300);
  });

  it('fit-clamps oversized images to 90% of the viewport, preserving aspect', async () => {
    __setImageMeasureForTests(async () => ({ width: 4000, height: 1000 }));
    const c = ctx();
    await kitImageHandler.handle([item(file('big.png'))], c);
    const [bounds] = c.insert.commit.mock.calls[0];
    expect(bounds.width).toBeCloseTo(720);   // 800 * 0.9
    expect(bounds.height).toBeCloseTo(180);  // aspect preserved
  });

  it('cascades multiple files by a fixed offset', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitImageHandler.handle([item(file('a.png')), item(file('b.png'))], c);
    const [b0] = c.insert.commit.mock.calls[0];
    const [b1] = c.insert.commit.mock.calls[1];
    expect(b1.x - b0.x).toBe(24);
    expect(b1.y - b0.y).toBe(24);
  });

  it('prefers ctx.resolveSrc over the data-URI embed', async () => {
    const c = ctx({ point: { x: 0, y: 0 }, resolveSrc: async () => 'https://cdn/x.png' });
    await kitImageHandler.handle([item(file('a.png'))], c);
    expect(c.insert.commit.mock.calls[0][1]).toEqual({ kind: 'image', src: 'https://cdn/x.png' });
  });

  it('a file that fails to measure is skipped with a warn; others proceed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    __setImageMeasureForTests(async () => {
      if (n++ === 0) throw new Error('bad image');
      return { width: 10, height: 10 };
    });
    const c = ctx({ point: { x: 0, y: 0 } });
    await kitImageHandler.handle([item(file('bad.png')), item(file('ok.png'))], c);
    expect(c.insert.commit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/ingestion/imageHandler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/ingestion/imageHandler.ts`:

```ts
/**
 * The kit's `image/*` content handler — the one handler shipped by default.
 *
 * For each image file: resolve a `src` (consumer `resolveSrc` when provided,
 * else embed as a `data:` URI so the scene stays serializable), measure the
 * natural pixel size, fit-clamp to 90% of the visible viewport, and insert a
 * leaf node with `data.image = { src }` via the insert dep (id/layer/undoable
 * op supplied there — same contract as `useImageTool`).
 *
 * Placement: centered on `ctx.point` (drop / pointed ingest) or the viewport
 * center (paste / point-less). Multi-file ingests cascade by a fixed offset.
 *
 * Registered at priority -100 so any consumer handler (default 0) can take
 * image files first.
 */
import type { ContentHandlerEntry, IngestCtx } from './contentHandlers';
import type { IngestItem } from './ingestItems';

const CASCADE_OFFSET_PX = 24;
const VIEWPORT_FIT = 0.9;

type Measure = (file: File) => Promise<{ width: number; height: number }>;
type ToDataUri = (file: File) => Promise<string>;

const defaultMeasure: Measure = async (file) => {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
};

const defaultToDataUri: ToDataUri = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

let measure: Measure = defaultMeasure;
let toDataUri: ToDataUri = defaultToDataUri;

export const kitImageHandler: ContentHandlerEntry = {
  id: 'kit:image',
  match: (item: IngestItem) => item.kind === 'file' && item.mime.startsWith('image/'),
  priority: -100,
  async handle(items, ctx: IngestCtx) {
    const files = items.flatMap((it) => (it.kind === 'file' ? [it.file] : []));
    let index = 0;
    for (const file of files) {
      try {
        const src = ctx.resolveSrc ? await ctx.resolveSrc(file) : await toDataUri(file);
        const natural = await measure(file);
        const view = ctx.viewportWorldRect();
        const scale = Math.min(
          1,
          (view.width * VIEWPORT_FIT) / natural.width,
          (view.height * VIEWPORT_FIT) / natural.height,
        );
        const width = natural.width * scale;
        const height = natural.height * scale;
        const center = ctx.point ?? {
          x: view.x + view.width / 2,
          y: view.y + view.height / 2,
        };
        const offset = index * CASCADE_OFFSET_PX;
        ctx.insert.commit(
          {
            x: center.x - width / 2 + offset,
            y: center.y - height / 2 + offset,
            width,
            height,
          },
          { kind: 'image', src },
        );
        index++;
      } catch (err) {
        console.warn(`weasel ingest: image "${file.name}" failed to load`, err);
      }
    }
  },
};

/** @internal test seam — override the bitmap measurer (jsdom has no
 *  `createImageBitmap`). Not part of the public barrel. */
export function __setImageMeasureForTests(fn: Measure): void {
  measure = fn;
}

/** @internal test seam — override the FileReader embed. */
export function __setFileToDataUriForTests(fn: ToDataUri): void {
  toDataUri = fn;
}

/** @internal test seam — restore default seams. */
export function _resetImageHandlerSeamsForTests(): void {
  measure = defaultMeasure;
  toDataUri = defaultToDataUri;
}
```

Note the `extras` shape `{ kind: 'image', src }` — this is `InsertExtras` for the insert dep's existing `'image'` case (`src/canvas/deps/insert.ts:182`). If `InsertExtras` is a stricter type than `{ kind: string }`, extend it the same way the shape tools' extras are declared in `src/interactions/actions/depSchema.ts` (~line 189).

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/features/ingestion && npx tsc --noEmit`
Expected: PASS.

```bash
git add src/features/ingestion
git commit -m "feat(ingestion): kit image/* handler — embed or resolveSrc, fit-clamp, cascade, undoable insert"
```

---

### Task 8: `openFilePicker` helper + feature barrel

**Files:**
- Create: `src/features/ingestion/openFilePicker.ts`
- Create: `src/features/ingestion/index.ts`
- Test: `src/features/ingestion/openFilePicker.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/ingestion/openFilePicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openFilePicker } from './openFilePicker';

describe('openFilePicker', () => {
  it('resolves the chosen files and removes its input', async () => {
    const p = openFilePicker({ accept: 'image/*', multiple: true });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('image/*');
    expect(input.multiple).toBe(true);
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [f] });
    input.dispatchEvent(new Event('change'));
    await expect(p).resolves.toEqual([f]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('resolves [] on cancel', async () => {
    const p = openFilePicker();
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    input.dispatchEvent(new Event('cancel'));
    await expect(p).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/ingestion/openFilePicker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/features/ingestion/openFilePicker.ts`:

```ts
/**
 * `openFilePicker` — tiny DOM helper opening the OS file dialog and resolving
 * the chosen `File[]` ([] on cancel). Pairs with `CanvasExtensionApi.ingest`:
 *
 * ```ts
 * const files = await openFilePicker({ accept: 'image/*', multiple: true });
 * canvasRef.current?.ingest(files);
 * ```
 *
 * Must be called from a user-activation context (a click handler) — browsers
 * block programmatic `input.click()` otherwise.
 */
export interface OpenFilePickerOptions {
  /** `<input accept>` filter, e.g. `'image/*'` or `'.csv,text/csv'`. */
  accept?: string;
  /** Allow multi-select. Default false. */
  multiple?: boolean;
}

export function openFilePicker(opts: OpenFilePickerOptions = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    if (opts.accept) input.accept = opts.accept;
    if (opts.multiple) input.multiple = true;
    document.body.appendChild(input);
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    // Fired by browsers that support it when the dialog is dismissed. When
    // unsupported, the input simply leaks until the page unloads — acceptable
    // for a hidden element; no timer heuristics.
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
```

`src/features/ingestion/index.ts`:

```ts
export {
  registerContentHandler,
  getContentHandlers,
  runIngest,
  type ContentHandlerEntry,
  type IngestCtx,
} from './contentHandlers';
export {
  itemsFromDataTransfer,
  itemsFromClipboardData,
  INGEST_STRING_MIMES,
  type IngestItem,
} from './ingestItems';
export { kitImageHandler } from './imageHandler';
export { openFilePicker, type OpenFilePickerOptions } from './openFilePicker';
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/features/ingestion`
Expected: PASS.

```bash
git add src/features/ingestion
git commit -m "feat(ingestion): openFilePicker helper + feature barrel"
```

---

### Task 9: SceneCanvas wiring — `ingestion` prop, kit-handler registration, `ingest()` on the ref, `trigger()` deps

**Files:**
- Modify: `src/interactions/actions/registry.tsx:377-403`
- Modify: `src/canvas/canvasExtension.ts`
- Modify: `src/canvas/SceneCanvas.tsx`
- Test: `src/canvas/SceneCanvas/__tests__/` or alongside existing SceneCanvas tests — `src/canvas/sceneCanvas.ingestion.test.tsx`

- [ ] **Step 1: `registry.trigger` builds deps from `requires`**

In `src/interactions/actions/registry.tsx`, replace the hardcoded deps bag inside `trigger` (line ~385) with a `requires`-driven build, falling back to the legacy fixed bag for actions that don't declare `requires`:

```ts
      trigger: (id: string, params?: Record<string, unknown>) => {
        const a = actionsRef.current.get(id);
        if (!a) return false;
        try {
          if (a.invoker && a.invoker.timing === 'immediate') {
            const r = depRegRef.current;
            // Prefer the action's declared `requires` (same contract the
            // dispatcher's buildDeps uses); legacy fixed bag otherwise.
            const requires = (a as unknown as { requires?: string[] }).requires;
            const deps = !r
              ? {}
              : requires
                ? Object.fromEntries(requires.map((n) => [n, r.get(n as DepName)]))
                : {
                    selection: r.get('selection' as DepName),
                    scene: r.get('scene' as DepName),
                    history: r.get('history' as DepName),
                    view: r.get('view' as DepName),
                    pointer: r.get('pointer' as DepName),
                    activeTool: r.get('activeTool' as DepName),
                    booleansAdapter: r.get('booleansAdapter' as DepName),
                  };
            a.invoker.run(deps as never, params);
          }
        } catch (err) {
          console.error(`weasel ActionsRegistry: action "${id}" threw`, err);
        }
        return true;
      },
```

- [ ] **Step 2: Extend `CanvasExtensionApi`**

In `src/canvas/canvasExtension.ts`, add to the interface (with an `IngestItem` type import from `features/ingestion/ingestItems`):

```ts
  /** Feed external content into the ingestion pipeline imperatively — the
   *  same content-handler registry that OS drop and clipboard paste hit.
   *  `input` may be raw `File[]` (e.g. from `openFilePicker`) or
   *  pre-normalized `IngestItem[]`. `point` is a world-space placement
   *  anchor; omitted → handlers use their point-less policy (the kit image
   *  handler centers on the viewport). */
  ingest(input: File[] | IngestItem[], point?: { x: number; y: number }): void;
```

- [ ] **Step 3: SceneCanvas — `ingestion` prop + registration effect + ref method**

In `src/canvas/SceneCanvas.tsx`:

(a) Add to `SceneCanvasProps` (near `insertNodeFactories`):

```ts
    /** External-content ingestion (OS drop / clipboard paste / picker).
     *  `handlers` are consumer content handlers registered for this canvas's
     *  lifetime (priority 0 by default — they beat the kit's `image/*`
     *  handler at -100). `resolveSrc` overrides the image handler's
     *  `data:`-URI embed (e.g. upload to an asset store, return the URL). */
    ingestion?: {
      handlers?: ContentHandlerEntry[];
      resolveSrc?: (file: File) => Promise<string>;
    };
```

with `import { registerContentHandler, kitImageHandler, type ContentHandlerEntry, type IngestItem } from 'features/ingestion';`.

(b) Register the kit handler once per mount plus consumer handlers, inside `SceneCanvasInner` (module-level idempotence is NOT wanted — disposers keep tests clean):

```ts
  // Content-handler registration: the kit image handler plus any consumer
  // handlers, for this canvas's lifetime. The registry is module-global, so
  // guard against double-registering kit:image across multiple canvases.
  const consumerHandlers = ingestion?.handlers;
  useEffect(() => {
    const disposers: Array<() => void> = [];
    if (!getContentHandlers().some((h) => h.id === kitImageHandler.id)) {
      disposers.push(registerContentHandler(kitImageHandler));
    }
    for (const h of consumerHandlers ?? []) disposers.push(registerContentHandler(h));
    return () => disposers.forEach((d) => d());
  }, [consumerHandlers]);
```

(add `getContentHandlers` to the import).

(c) Mount the dep source in `StandardActionsRegistrar` alongside `useInsertDepSource` (thread `canvasRef`-equivalent + view getter + `resolveSrc` down the same way `insertNodeFactories` was threaded in commit `769a09e0` — prop on `StandardActionsRegistrar`, populated from `SceneCanvasInner`'s `internalCanvasRef` and `currentViewRef`):

```ts
  useIngestionDepSource(canvasElRef, getView, ingestResolveSrc);
```

(d) Extend the imperative ref handle (find where the `CanvasExtensionApi` object is assembled — near `canvasApiRef`, ~line 824-830) with:

```ts
    ingest: (input: (File | IngestItem)[], point?: { x: number; y: number }) => {
      const items: IngestItem[] = input.map((entry) =>
        entry instanceof File
          ? { kind: 'file', mime: entry.type || 'application/octet-stream', file: entry }
          : entry,
      );
      if (items.length === 0) return;
      registry.trigger('ingest', {
        items,
        ...(point ? { worldX: point.x, worldY: point.y } : {}),
      });
    },
```

(`registry` = the actions registry already in scope via `useActionsRegistry()`; if the api object is built where the registry isn't in scope, thread it via a ref the same way `canvasApiRef` is populated.)

- [ ] **Step 4: Write the integration test**

`src/canvas/sceneCanvas.ingestion.test.tsx` — follow an existing SceneCanvas test's mount pattern (scene + selection + `render(<SceneCanvas …/>)`):

```tsx
// Behaviors to assert (build on an existing SceneCanvas test's harness):
// 1. Mounting SceneCanvas registers kit:image exactly once (two canvases
//    mounted → getContentHandlers() still has one kit:image entry).
// 2. `ingestion.handlers` entries are registered on mount, disposed on unmount.
// 3. ref.ingest([pngFile], { x: 50, y: 60 }) inserts a node: use
//    __setImageMeasureForTests + __setFileToDataUriForTests seams, then
//    await vi.waitFor(() => scene nodes contain one with data.image.src);
//    assert its pose is centered on (50, 60).
// 4. ref.ingest with no point centers in the viewport (pose center ≈ canvas
//    center in world coords at identity view).
```

Every numbered behavior becomes a real `it(...)` with full assertions.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/canvas/sceneCanvas.ingestion.test.tsx src/interactions/actions/registry.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/canvas src/interactions/actions/registry.tsx
git commit -m "feat(SceneCanvas): ingestion prop + CanvasExtensionApi.ingest; trigger() honors action requires"
```

---

### Task 10: Public exports + docs

**Files:**
- Modify: `src/index.ts`
- Modify: `docs/taxonomy.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Public barrel**

In `src/index.ts` (match the barrel's existing grouping/comment style):

```ts
// --- External-content ingestion ---
export {
  registerContentHandler,
  openFilePicker,
  type ContentHandlerEntry,
  type IngestCtx,
  type IngestItem,
  type OpenFilePickerOptions,
} from 'features/ingestion';
```

Deliberately NOT exported: `runIngest`, `getContentHandlers`, `kitImageHandler`, the materialization helpers, and all `__…ForTests` seams (kit-internal).

- [ ] **Step 2: taxonomy.md**

In the Gesture section of `docs/taxonomy.md` (~line 187), add drop/paste to the enumerated gesture forms, one sentence: OS file drop and clipboard paste are gestures (`DropSpec` / `PasteSpec`); their default routing is the ambient `ingest` action → content-handler registry (see the 2026-07-03 ingestion spec).

- [ ] **Step 3: TODO.md**

- Delete the P1 index line and rewrite the P1 body entry as shipped with residuals, per the repo's completed-entry retention policy (keep only while follow-ups are open):

```markdown
- **(P3) External-content ingestion — follow-ups.** Shipped 2026-07-03 (spec
  `docs/superpowers/specs/2026-07-03-content-ingestion-design.md`): drop/paste
  gesture kinds, dispatcher DOM channels, ambient `ingest` action, content-
  handler registry (`src/features/ingestion/`), kit `image/*` handler
  (embed / `resolveSrc`), `openFilePicker`, `CanvasExtensionApi.ingest`,
  `<SceneCanvas ingestion={…}>`. Remaining: (a) richer drag-over feedback
  (insertion ghost / per-handler accept cursor — v1 is the `weasel-dropover`
  class); (b) SVG-file drop → scene-node parsing (future handler; proves
  registry extensibility); (c) kit `text/plain` handler → text node insert.
```

- Restore `### P1 — foundational genericity gaps` to `(none currently open)`.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run src/features/ingestion`
Expected: clean.

```bash
git add src/index.ts docs/taxonomy.md docs/TODO.md
git commit -m "docs+exports: public ingestion surface; taxonomy gains drop/paste; TODO P1 → shipped"
```

---

### Task 11: Demo

**Files:**
- Create: `apps/site/demos/IngestionDemo.tsx`
- Modify: `apps/site/registry.ts` (new entry — copy an existing entry's shape)
- Modify: `apps/site/canvas-kit-demo.css` (dropover style)

- [ ] **Step 1: Write the demo**

`apps/site/demos/IngestionDemo.tsx`:

```tsx
import { useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  openFilePicker,
  type CanvasExtensionApi,
  type ContentHandlerEntry,
} from '@weasel-js/core';

const W = 600, H = 400;

interface NodeData { image?: { src: string }; path?: unknown; fill?: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

export function IngestionDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection({ mode: 'multi' });
  const ref = useRef<CanvasExtensionApi>(null);
  const [readout, setReadout] = useState('drop an image, paste one, or use the picker');

  // Consumer handler: dropped/pasted plain text lands in the readout —
  // shows registering a non-image content type.
  const [textHandler] = useState<ContentHandlerEntry[]>(() => [{
    id: 'demo:text',
    match: 'text/plain',
    handle: (items) => {
      const text = items.map((i) => (i.kind === 'string' ? i.text : i.file.name)).join(' ');
      setReadout(`text arrived: "${text.slice(0, 80)}"`);
    },
  }]);

  return (
    <div className="ckd-shape-tools-demo">
      <div className="ckd-toolbar">
        <button
          onClick={async () => {
            const files = await openFilePicker({ accept: 'image/*', multiple: true });
            ref.current?.ingest(files);
          }}
        >
          Insert image…
        </button>
        <span className="ckd-readout">{readout}</span>
      </div>
      <SceneCanvas
        ref={ref}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        toolBundle="minimal"
        ingestion={{ handlers: textHandler }}
      />
    </div>
  );
}
```

Check `apps/site/demos/ImageDemo.tsx` and the css file for the real class names (`ckd-toolbar` / `ckd-readout` may not exist — reuse whatever the other demos use for a toolbar row + status line).

- [ ] **Step 2: Register the demo**

Add an entry in `apps/site/registry.ts` next to the ImageDemo entry (copy its shape: id, title, description, tags, component import). Description: "OS file drop, clipboard paste, and a file picker all landing through one content-handler registry."

- [ ] **Step 3: Dropover style**

In `apps/site/canvas-kit-demo.css`:

```css
/* External-content drag feedback: the dispatcher toggles this class on the
   canvas while an OS drag hovers it. */
.ckd-canvas.weasel-dropover {
  outline: 2px dashed #4a90d9;
  outline-offset: -2px;
}
```

- [ ] **Step 4: Verify by hand**

Run: `npm run dev:kit` (background), open the demo page, verify: drag an image file over the canvas (dashed outline appears), drop it (image lands at the drop point), Cmd+V an image copied from a browser, click "Insert image…". Check the console for errors.

- [ ] **Step 5: Commit**

```bash
git add apps/site
git commit -m "feat(demo): ingestion demo — drop / paste / picker through the content-handler registry"
```

---

### Task 12: Release gate

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
(matches the `prepublishOnly` gate; browser-mode visual tests run in CI). Expected: all green. Fix anything that isn't before declaring done.

- [ ] **Step 2: Final commit if the gate required fixes**

```bash
git add -A && git commit -m "chore(ingestion): release-gate fixes"
```

---

## Amendments from Task 1 code review (2026-07-03)

Carried into the later tasks' dispatch (deltas vs. the task text above):

- **Task 2 (+):** normalize MIME strings at materialization — strip parameters
  (`'text/plain;charset=utf-8'` → `'text/plain'`) in both `itemsFromDataTransfer`
  and `itemsFromClipboardData` (`mime.split(';')[0].trim().toLowerCase()`), + test.
  Exact matching downstream assumes bare `type/subtype`.
- **Task 3 (±):** do NOT duplicate `mimeMatchesGlob` kit-side. Instead export
  `mimeMatchesGlob` + `matchIngestTypes` from `@weasel-js/gestures` (barrel) and
  import in `contentHandlers.ts` — the binding filter and the handler registry
  are two halves of one routing decision and must not drift. While in the
  package: document that `types: []` ≡ omitted ("omitted or empty = match any"),
  and add edge tests (empty `items`, `types: []`, bare `'*'`, case-insensitivity).
- **Task 5 (+):** the ingest action's `defaultBinding` must use all-optional
  mods — `matchModifiers` treats omitted as forbidden, so a bare
  `{ kind: 'drop' }` would fail on macOS Option-drag (and any modified paste):
  `const ANY_MODS = { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' } as const;`
  on both binding specs. (`'optional'` is supported on every modifier —
  `packages/gestures/src/ui/match.ts:52`.)
- **Task 5 (+):** `specificity()` (`src/interactions/dispatcher/matcher.ts:71`)
  gives `types` no weight — two ambient drop bindings (kit ingest vs. a
  consumer's `types: ['text/csv']`) tie and resolve by registration order.
  Use the reserved `[3]` slot: `2` when the spec has a non-empty `types`,
  else `1`, + a `matchSorted` test showing the typed binding wins.
- **Task 6 (=):** keep forwarding real modifiers on drop events (the optional-
  mods binding absorbs them); paste keeps all-false (ClipboardEvent carries no
  modifier state) — already in the task text, now load-bearing.
- **Task 9 (±, from Task 3 review):** the kit-handler registration guard in
  SceneCanvas must NOT be a naive skip-if-present: with two mounted canvases,
  if mount A registered `kit:image` and unmounts first, mount B is left with
  no image handler. Refcount instead — module-level
  `let kitImageRegistrations = 0` beside a shared disposer: mount increments
  (registering on 0→1), unmount decrements (disposing on 1→0). Test with two
  mounted canvases unmounting in registration order.
- **Task 10 (+, from Task 9 review):** add `SceneCanvasApi extends
  CanvasExtensionApi` declaring `ingest(...)` required; type SceneCanvas's
  forwarded ref as `React.Ref<SceneCanvasApi>` and export the interface —
  removes the `ref.current!.ingest!(…)` tax (the optional method stays on the
  base for the bare-primitive handle). Also unify the two hand-rolled dep-bag
  builders: extract a shared `buildDepsFromRequires(action, depRegistry)`
  (with the dispatcher's dev-mode undeclared-dep proxy guard) used by BOTH
  `dispatcher.buildDeps` and `registry.trigger`; consider promoting
  `requires?: DepName[]` onto `Action` to kill the duplicated casts. Plus one
  10-line integration test: `ingestion={{ resolveSrc }}` on SceneCanvas →
  inserted node's `src` is the resolved URL (the prop-threading hop is
  currently untested end-to-end).
- **Task 10 (+):** extend the comment above `SPEC_KIND_TO_GESTURE` in
  `apps/draw/src/dev/registryProbe.tsx` to cover drop/paste (currently explains
  only the multiTouch gap); note route-grammar names for drop/paste as a
  follow-up in TODO.md's residuals list.

## Self-review notes

- **Spec coverage:** gesture layer (T1), normalization incl. eager string reads + editable-paste guard (T2, T6), ambient `ingest` action + interception via scopes (T5), registry partition/priority/dwarn/error-isolation (T3), image handler embed/resolveSrc/fit-clamp/cascade/placement (T7), picker + imperative ingest (T8, T9), dropover class (T6, T11), docs (T10), demo w/ custom text handler (T11). Out-of-scope items from spec §7 untouched.
- **Types:** `IngestItem` defined once in `@weasel-js/gestures`, re-exported through `features/ingestion` and the public barrel. `IngestCtx.insert` uses the existing `InsertDep`; extras `{ kind: 'image', src }` matches `insert.ts:182`.
- **Known verify-at-implementation points** (marked inline): `View` type field names/import path (T4), `InsertExtras` strictness (T7), demo css class names (T11), `useStandardActions` descriptor-count test (T5).
