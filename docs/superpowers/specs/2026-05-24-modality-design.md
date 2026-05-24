# Modality in WeaselDraw

Design doc for introducing a first-class concept of modality to the weasel kit and the WeaselDraw app. Brainstormed 2026-05-24.

## Motivation

WeaselDraw needs Photoshop/Illustrator-style modes: bounded app states (path edit, free transform, isolation, text edit, crop) that restrict which tools and operations are available, surface clear commit/cancel semantics where appropriate, and provide unmistakable visual feedback so the user always knows what state they're in.

Today, modal behaviors are scattered across tool internals (e.g., pen tool considering whether it's mid-path). This conflates *creation* with *editing*: the pen tool creates paths, but a user editing anchors on a path doesn't care how the path was created. Path-edit belongs to the app, not to any single tool.

## Scope

In scope:

- A kit-level **`Journal`** primitive (scoped sub-history with its own undo stack, suspend/resume, commit/cancel).
- A new **`weasel-history`** package housing both `History` (existing) and `Journal` (new).
- A new **`weasel-modes`** package providing the mode primitives and a stock preset of six modes.
- WeaselDraw integration: mode-switch chrome, workspace tinting, palette greying.

Out of scope (deliberately deferred):

- Mask primitives (separate design).
- Symbol / component edit modes.
- Quick mask, slice, vanishing point, 3D modes.
- Splitting `weasel-debug` out of core.

## Architecture

### Layer split

```
weasel/core (ops, scene, adapter)
        │
        ├── weasel-history (History, Journal)
        │           │
        │           └── weasel-modes (mode registry, capability tags, presets)
        │                       │
        │                       └── apps/weaseldraw (consumer-specific mode machine)
        │
        └── weasel-gestures (unchanged)
```

`weasel-history` depends only on `core/ops` types. `weasel-modes` depends on `weasel-history` and `weasel-gestures`. Apps that don't want modality skip `weasel-modes`.

### Hybrid modality model

Two kinds of modes coexist:

- **Soft modes** (path-edit, isolation, text-edit) — scoped editing context, no commit/cancel ceremony. Every edit during the session is independently undoable. Exit is single-shortcut (`⎋`) and non-destructive.
- **Strict modes** (free-transform, crop) — atomic transactional sessions. The entire interactive session is one undoable thing; explicit commit (`↵`) or cancel (`⎋`) is required. Mid-session granular undo still works via the journal's internal stack.

Modes are app-level UX states, not tool-internal phases. A tool never "is in" a mode; modes contain tools.

## The `Journal` primitive

`Journal` is a scoped sub-history. While a journal is active on a parent `History`, all `applyBatch` calls route to the journal instead of the parent. The journal accumulates ops in its own forward-stack (with the same coalescing rules as `History`), and on `commit` flushes its net forward ops as a single labeled entry on the parent.

### API

```ts
interface Journal {
  // Same operational surface as History — UI bound to history works unchanged
  applyBatch(ops: Op[], label: string): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  entries(): { undo: HistoryEntry[]; redo: HistoryEntry[] }

  // Lifecycle
  commit(label: string): void   // flush net forward ops as one parent entry, close journal
  cancel(): void                // replay inverses on scene, discard, parent untouched
  suspend(): void               // close active state, keep stack + baseline for later resume
}

interface History {
  // existing methods unchanged

  beginJournal(opts: { targetId?: string; label: string }): Journal
  resumeJournal(journal: Journal): void   // errors if stale
}
```

### Suspend / resume

Soft modes default to **suspend on exit**, not commit. The journal closes its active state but retains its op stack and the parent-history entry-id it was forked at.

Re-entering the same mode on the same target:

1. App looks up cached journal by `targetId`.
2. Kit checks whether any parent-history entries since the fork-id touched the journal's target (or any anchors of it). Touched ⇒ stale ⇒ discard, start fresh. Untouched ⇒ resume.

This keeps the rule local and simple. No rebasing, no conflict resolution. Worst case: a fresh path-edit session, which is exactly today's behavior.

Cache policy is the consumer's responsibility. WeaselDraw policy: **LRU of last 8 suspended journals, cleared on save/load**.

Explicit `discard` (`⌘⎋` in WeaselDraw) calls `journal.cancel()` and drops it from the cache. Plain exit (`⎋`) calls `journal.suspend()` and keeps it.

### Strict modes use `Journal` too

Strict modes open a journal at entry and either `commit(label)` or `cancel()` at exit. They never `suspend`. So `Journal` is the single primitive for both kinds; strict vs. soft is purely a matter of which lifecycle calls the mode uses.

### Nesting

`beginJournal` while one is open throws. A canvas has at most one active journal at a time. Strict-mode + strict-mode nesting is not motivated by any current UX need; permitting it is unnecessary complexity.

Exception: `free-transform` may be opened inside `isolation`. We model this by treating `isolation` as a *scoped surrounding workspace* — not as a "stacked mode." Equivalently: only one *strict* journal can be open at a time. `isolation`'s journal stays suspended-but-active-context while `free-transform`'s journal runs; on commit, free-transform's entry lands on `isolation`'s journal (not on the root parent), preserving the natural rollup.

### Transactions and persistence

`History.serialize()` snapshots committed entries only. A half-open journal is not persisted; on page reload mid-mode, the journal is lost and the scene reflects the last committed state. (The journal's accumulated ops would be visible in the live scene at unload time, but won't survive the next load. This is an acceptable simplification; closing-the-laptop-mid-transform losing the transform is conventional behavior.)

## The `weasel-modes` package

### Capability tags

Tools declare zero or more capability tags. The taxonomy in the default preset:

| Tag | Tools |
|---|---|
| `navigation` | hand, zoom |
| `selection` | select (arrow), marquee |
| `creates-paths` | pen, pencil |
| `creates-shapes` | rect, ellipse, line |
| `creates-text` | text tool (placing a new text node) |
| `edits-anchors` | direct-select, add-anchor, delete-anchor, convert-anchor, scissors |
| `edits-text` | text caret inside a text node |
| `transforms-selection` | free-transform handles |
| `samples-color` | eyedropper |
| `applies-fill` | fill-bucket, gradient |
| `edits-page` | crop/page-resize handles |

`navigation` is implicit in every mode — kit convention, not listed per-mode. Pan and zoom always work.

Tags are extensible. Apps and other consumers can add tags and tools that carry them without modifying `weasel-modes`.

### Mode definition

```ts
interface ModeDefinition {
  id: string
  kind: 'soft' | 'strict'
  allows: CapabilityTag[]    // tools with any of these tags are eligible
  scoping: boolean           // dims out-of-target objects when true
  workspace?: {
    tint?: string            // CSS color
    gradient?: 'top-down' | 'bottom-up'  // default 'bottom-up'
    intensity?: number       // alpha at the strong end (default 0.12)
  }
  entry?: { shortcut?: string; trigger?: 'double-click-target' }
  exit?: { shortcut?: string }  // soft modes
  commit?: { shortcut?: string }  // strict modes
  cancel?: { shortcut?: string }  // strict modes
}
```

### Mode-owned overlay/decoration layer

Modes can render persistent decorations on the canvas independent of any active tool. Path-edit owns the anchor dots, handle lines, and hover highlights — these are always visible while in path-edit, regardless of which sub-tool (direct-select, add-anchor, scissors, etc.) is currently active. This is a new affordance layer in the kit, distinct from per-tool overlays.

### Stock preset (default)

Six modes, defined in `weasel-modes/presets/default.ts`:

| Mode | Kind | Allows (beyond `navigation`) | Scoping | Tint | Entry | Exit / Commit |
|---|---|---|---|---|---|---|
| `normal` | soft | `selection`, `creates-paths`, `creates-shapes`, `creates-text`, `samples-color`, `applies-fill`, `edits-page` | no | — | default | n/a |
| `path-edit` | soft | `edits-anchors` | yes — target path | blue `#3b82f6` | dbl-click path / `↵` on selected path | `⎋` suspend / `⌘⎋` discard |
| `isolation` | soft | `selection`, `creates-paths`, `creates-shapes`, `creates-text`, `samples-color`, `applies-fill` (scoped to isolated subtree) | yes — target group | violet `#8b5cf6` | dbl-click group | `⎋` / breadcrumb back |
| `free-transform` | strict | `transforms-selection` | no | amber `#f59e0b` | `⌘T` / menu | `↵` commit / `⎋` cancel |
| `text-edit` | soft | `edits-text` | no | green `#10b981` | dbl-click text node / text-tool on text node | `⎋` / click outside |
| `crop` | strict | `edits-page` | no | red `#ef4444` | `C` / menu | `↵` commit / `⎋` cancel |

## Mode-switch UX

### Entry

- **Double-click** on a target enters the obvious mode for that target type (path → path-edit, group → isolation, text node → text-edit).
- **Keyboard shortcuts** per the table above.
- **Menu items** as the comprehensive list.

### Exit

- **`⎋`** universally exits soft modes (suspend) and cancels strict modes.
- **`↵`** commits strict modes; ignored in soft modes.
- **`⌘⎋`** discards a soft mode's journal entirely (no resume).

### Visual treatment

Four overlapping signals — mode states should be unmistakable:

1. **Tool palette greying.** Ineligible tools render at ~30% opacity with a "Disabled in <Mode>" tooltip. Position-stable; preserves muscle memory. Greying, not hiding.
2. **Workspace dimming** (scoping modes only). Out-of-target objects render at 30% opacity and become non-interactive. Applied at the scene-render layer, not via CSS, so it composes correctly with the workspace gradient.
3. **Workspace gradient.** A `linear-gradient(to bottom, var(--mode-tint) 0%, transparent 100%)` (or top-down per mode) overlay on `.wd-canvas-host` via `::before`, behind the page, above the workspace stripes. `pointer-events: none`. Short fade transition (~150ms) on mode entry/exit.
4. **Mode chrome.** A thin breadcrumb bar pinned to the top of `.wd-canvas-host`:
   - Soft modes: `Path Edit · "Circle Path" · [Exit]`
   - Strict modes: `Free Transform · [Cancel ⎋] [Commit ⏎]`
5. **Status bar text.** Mode name in the existing tool/sel/zoom row. Passive secondary indicator.

Cursor changes happen automatically via the mode-owned decoration layer — not a separate signal.

## WeaselDraw integration

WeaselDraw owns:

- The concrete `Mode` enum (six values matching the preset).
- The mode-switch state machine (which mode is active, transitions, dispatch of entry/exit triggers).
- The journal cache (LRU 8, save/load policy).
- The mode chrome React components (breadcrumb bar, status bar text).
- Wiring entry triggers (double-click handlers, keybinding registrations) to the mode machine.

Kit provides: `Journal`, capability tags, mode definitions, mode-owned decoration layer, eligibility predicate.

## What lives where (file plan)

```
packages/weasel-history/
  src/
    History.ts          (moved from src/core/history/history.ts)
    Journal.ts          (new)
    serialize.ts        (moved)
    index.ts

packages/weasel-modes/
  src/
    types.ts            (ModeDefinition, CapabilityTag)
    registry.ts         (active mode, transitions)
    decorations.ts      (mode-owned overlay layer)
    presets/
      default.ts        (the six stock modes)
    index.ts

src/core/
  ops/                  (unchanged)
  applyOps.ts           (now imports History from weasel-history)
  history/              (DELETED — moved to weasel-history)

apps/weaseldraw/
  src/modality/
    machine.ts          (the consumer-specific mode machine)
    journalCache.ts     (LRU 8)
    chrome/
      ModeBreadcrumb.tsx
      ModeStatusIndicator.tsx
```

## Open questions

None blocking. A few that will surface during implementation:

- Exact CSS-variable naming for the workspace tint (probably `--wd-mode-tint`, `--wd-mode-tint-intensity`).
- Whether `discard` should have UI affordance beyond `⌘⎋` (probably a "Discard" item in the mode chrome's overflow menu).
- Whether `isolation + free-transform` rollup (the one allowed nesting case) needs special UI treatment in the breadcrumb (probably a two-segment breadcrumb: `Isolation · Free Transform`).

## Implementation order

This is the suggested phasing for the plan stage:

1. Extract `History` + serialize into `weasel-history` package. No new behavior.
2. Build `Journal` in `weasel-history` alongside `History`. Wire `History.beginJournal`. Tests.
3. Create `weasel-modes` package skeleton with capability-tag types and `ModeDefinition`.
4. Define the six stock modes in `weasel-modes/presets/default.ts` (data only, no runtime yet).
5. Build the mode-owned decoration layer in the kit.
6. WeaselDraw mode machine + journal cache + chrome.
7. Wire path-edit end-to-end as the first real mode (double-click entry, decoration layer, palette greying, workspace tint, suspend/resume).
8. Add the remaining modes one at a time.
