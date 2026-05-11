# Clipboard: cursor-relative paste

**Status:** design  
**Tier:** 1.5 (small additive hook)  
**Source TODO:** `docs/TODO.md` → "Clipboard: cursor-relative paste offsets"

## Problem

`useClipboard` / `useClipboardOps` always paste using a fixed cascade offset. Common editor UX — paste lands near the pointer on `Cmd+V` — is not reachable through the kit's keyboard or action-registry path. The `InsertAdapter.commitPaste` contract already accepts an optional `{ dropPoint }` ctx (`src/core/adapters/types.ts:199-203`); the hook just never passes one.

## Goals

- A hook-level seam through which a consumer can supply the current pointer (or any preferred drop point) per paste call.
- Keyboard `Cmd+V` and action-registry `clipboard.paste` automatically use the seam — no need to disable the kit's keybinding.
- Zero behavioral change when the seam is not wired (regression-safe for current consumers).

## Non-goals

- Implementing `arrayAdapter.commitPaste` (today a stub returning `[]`). Tracked separately.
- Auto-wiring `getDropPoint` from `SceneCanvas` pointer tracking. Follow-up after this lands cleanly.
- OS clipboard / cross-reload serialization. Separate Tier 1.5 entry.
- Auto-staggering successive same-cursor pastes. Matches Figma/Illustrator: user moves cursor between pastes.

## API

Add one option to `UseClipboardOpsOptions` and `UseClipboardOptions`:

```ts
/** Pulled once per paste() call. When non-null, threaded to
 *  commitPaste as `ctx.dropPoint`; adapters typically use it as the
 *  cluster origin (ignoring `offset`). When null/undefined, the hook
 *  falls back to the existing cascade-offset behavior. */
getDropPoint?: () => { worldX: number; worldY: number } | null;
```

No changes to `InsertAdapter` — `commitPaste(cb, offset, ctx?)` already accepts `ctx.dropPoint`.

## Paste lifecycle

Current (`clipboardOps.ts:49-66`):

1. Read `clipboardRef.current`.
2. `offset = getPasteOffset(cb) ?? {0,0}`.
3. `commitPaste(cb, offset)` → new nodes.
4. Dispatch `[InsertOp×N, SetSelectionOp]` batch.
5. Re-snapshot new ids → `clipboardRef.current` (cascade).

After:

1. Read `clipboardRef.current`.
2. `offset = getPasteOffset(cb) ?? {0,0}`.
3. `dropPoint = getDropPoint?.()` — pulled once, at this point.
4. `commitPaste(cb, offset, dropPoint ? { dropPoint } : undefined)`.
5. Dispatch batch.
6. Re-snapshot (unchanged).

## Edge cases

- `getDropPoint()` → `null`: behave exactly as today. Third arg omitted (or `undefined`).
- `getDropPoint()` throws: propagates. Consumer bug.
- Successive pastes without cursor movement: overlap. By design.
- Multiple `useClipboard` instances on one page: each holds its own `getDropPoint`. No shared state.

## Files touched

- `src/interactions/actions/clipboard/clipboardOps.ts` — option, thread through `paste()`.
- `src/interactions/actions/clipboard/clipboard.ts` — forward option from `useClipboard` → `useClipboardOps`.
- `src/interactions/actions/clipboard/clipboardOps.test.ts` — new tests (below).
- One demo (`demo/demos/ClipboardDemo.tsx` if it exists, else nearest demo that uses clipboard) — wire a pointer ref into `getDropPoint`.
- `docs/TODO.md` — mark entry shipped.

## Tests

In `clipboardOps.test.ts`, add against a mock adapter that records `commitPaste(cb, offset, ctx)`:

1. `getDropPoint` returning `{ worldX, worldY }` passes `{ dropPoint }` as third arg.
2. `getDropPoint` returning `null` calls `commitPaste` with third arg `undefined`.
3. Absent `getDropPoint` option: regression — third arg `undefined`.
4. `getDropPoint` invoked exactly once per `paste()` (no double-pull).
5. After a `getDropPoint`-driven paste, the clipboard re-snapshot still happens (next paste sees new ids as source).

## Done criteria

- `npm run prepublishOnly` clean (tsc + vitest + tsup).
- Demo manually verifies: copy a shape, move mouse to a new spot, `Cmd+V` lands at cursor.
- Existing clipboard tests untouched and green.

## Follow-ups (record as TODO entries)

- `arrayAdapter.commitPaste` real implementation — currently `() => []` (stub at `src/core/adapters/arrayAdapter.ts:188`); blocks end-to-end paste with the default adapter.
- `SceneCanvas` auto-wires `getDropPoint` from its own pointer tracking, so consumers using `<SceneCanvas>` get cursor-paste for free.
