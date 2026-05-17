# Registry unification — Phase 5: ActiveToolContext migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing local tools-state machinery (`useState` for active + hotkeyEngaged inside `useTools`) with the kit-owned `ActiveToolContext` (shipped Phase 1). Move the hotkey from a single-engaged-tool model to a stack model. Make "hold space for hand tool" a normal `ongoing` action that manipulates the context, retiring the special hotkey-engagement code path. The new gesture dispatcher (Phase 3) already reads from `ActiveToolContext`; Phase 5 ensures the context is populated and authoritative.

**Architecture:** Internal restructure that preserves `useTools`'s external `ToolsApi` for backwards compat (consumers and tools continue to call `tools.setActive(id)`). Internally, the state lives in `ActiveToolContext` (a React context); `useTools` reads/writes it. The hotkey engagement state moves from `hotkeyEngaged: string | null` (single-value) to a stack model (`hotkeyStack: string[]`) — `useTools.hotkeyEngaged` returns the top of the stack for compat. Tool-hotkey-hold ("Space for hand") is rewritten as an ongoing action descriptor that pushes/pops the stack.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–4.

---

## Prerequisites

Phase 4 must be shipped on main. Verify:
```
grep -q "DepRegistryProvider" src/index.ts && grep -q "escapeAction" src/interactions/actions/defaults/escape.ts
```
Both succeed.

## File map

**Modify:**
- `src/tools/useTools.ts` — replace local `useState` for active + hotkeyEngaged with reads/writes through `useActiveToolContext`. Preserve external `ToolsApi` shape; `hotkeyEngaged` becomes a derived getter (top of `hotkeyStack`).
- `src/tools/useKeybindings.ts` — calls to `tools.setActive` continue to work (they hit the context); the hotkey-engagement keydown handlers (space, alt, ctrl, meta, shift) call `pushHotkey`/`popHotkey` on the context instead of `engageHotkey`/`disengageHotkey`.
- `src/canvas/SceneCanvas.tsx` — auto-mount `<ActiveToolContextProvider>` if not already (Phase 3 may have set this up; verify). The dispatcher (Phase 3) reads from this context.
- `src/interactions/dispatcher/dispatcher.ts` — already reads `activeToolId` + `hotkeyStack` from `DispatcherContext` (Phase 3 wired this). No code change here; verify the wiring.
- `src/tools/dispatcher.ts` — the OLD tool-system dispatcher's slot mechanics: collapse `hotkey` to "top of context's hotkeyStack" for backwards compat. Drop the engageHotkey/disengageHotkey methods in favor of context push/pop.

**Create:**
- `src/interactions/actions/defaults/toolHold.ts` + test — new ongoing-action descriptor `tool.hold.<id>` (parametric) implementing the hold-to-engage hotkey pattern. Replaces the special-case keydown logic in `useKeybindings`.

**Not modified:**
- `ActiveToolContext` itself (Phase 1 shipped with the right shape).
- Phase 3's dispatcher (already context-aware).
- Built-in tools (their `hotkey` declarations get translated by the new `toolHoldAction`).

## Scope boundaries

- Does NOT change the external `useTools` / `useKeybindings` API surface — consumer demos keep working unchanged.
- Does NOT port ongoing-action ports for move/resize/etc. (Phase 6+).
- Does NOT delete the old `src/tools/dispatcher.ts` — only collapses its slot mechanics. Phase 10 deletes it entirely.
- Does NOT remove `engageHotkey` / `disengageHotkey` methods from `ToolsApi` — they keep working as shims that push/pop the context's stack.

## Hotkey: single → stack

Today's model: `hotkeyEngaged: string | null` — one held-key engages one tool at a time; re-engaging a different key cancels the first.

New model: `hotkeyStack: string[]` — multiple held keys stack. Popping returns to the previous (most recent) hotkey OR the active tool when empty.

In practice the kit has only one common pattern (Space for hand). The stack supports the rare case of pressing-Z-while-already-holding-Space and gives a clean LIFO behavior; the common case is identical.

`ToolsApi.hotkeyEngaged` (the existing field) returns `context.hotkeyStack.at(-1) ?? null` — preserves the single-string external view for consumers.

## Tool-hold as ongoing action

Per Q2 decision and the spec § "Clean fall-out". Each tool with a `hotkey` declaration (e.g. `useHandTool` has `hotkey: 'space'`) gets a corresponding `toolHoldAction` registered.

For Phase 5's scope: implement ONE parametric `toolHoldAction` that takes the target tool id from `BindingOpts.params.toolId`. Bindings register per-tool:

```ts
{
  spec: { kind: 'key-held', key: ' ' },
  actionId: 'tool.hold',
  opts: { params: { toolId: 'hand' } },
}
```

The action's invoker:

```ts
export const toolHoldAction: Action<readonly ['activeTool']> = {
  id: 'tool.hold',
  label: 'Hold to engage tool',
  requires: ['activeTool'] as const,
  invoker: {
    timing: 'ongoing',
    start: (ctx, opts) => {
      const toolId = opts?.params?.toolId as string | undefined;
      const activeTool = ctx.deps.activeTool;
      if (!toolId || !activeTool) return {};
      activeTool.pushHotkey(toolId);
      return {
        onEnd: () => { activeTool.popHotkey(); },
      };
    },
  },
};
```

Per-tool registration of the hold binding happens in `useKeybindings` (or wherever the kit collects tool-hotkey declarations). Today `useKeybindings` walks tools with `hotkey` set and wires keydown/keyup; Phase 5 has it instead register `toolHoldAction` bindings with the appropriate params at mount time, then the dispatcher takes over.

---

### Task 1: ActiveToolContext as the backing store for useTools

**Files:**
- Modify: `src/tools/useTools.ts`
- Modify: `src/tools/useTools.test.ts`

Replace local `useState<string>(opts.active)` and `useState<string | null>(null)` with reads/writes through `useActiveToolContext`.

The hook now requires `<ActiveToolContextProvider>` to be in scope (Phase 1 already provides this; SceneCanvas auto-mounts it in Phase 3). If no provider is in scope, throw a clear error (the context hook already throws).

Implementation outline:

```ts
import { useActiveToolContext } from 'interactions/actions/activeToolContext';

export function useTools(opts: UseToolsOptions): ToolsApi {
  const activeToolCtx = useActiveToolContext();
  // initial sync — set active to opts.active on first mount IF the context
  // is still at its default. Otherwise, respect the context's existing value.
  useEffect(() => {
    if (activeToolCtx.active === 'select' /* default */ && opts.active !== 'select') {
      activeToolCtx.setActive(opts.active);
    }
  }, []); // mount-only

  const active = activeToolCtx.active;
  const hotkeyStack = activeToolCtx.hotkeyStack;
  const hotkeyEngaged = hotkeyStack.at(-1) ?? null;

  const setActive = useCallback((id: string) => {
    if (!registryRef.current[id]) throw new Error(`setActive: "${id}" not in registry`);
    activeToolCtx.setActive(id);
  }, [activeToolCtx]);

  const engageHotkey = useCallback((id: string) => {
    activeToolCtx.pushHotkey(id);
  }, [activeToolCtx]);

  const disengageHotkey = useCallback(() => {
    activeToolCtx.popHotkey();
  }, [activeToolCtx]);

  // ... rest of the hook (overlays, dispatcher wiring, etc.) reads from these.
}
```

(Be careful with the "initial sync" — when `useTools` mounts after Phase 5, the context might already have a non-default active from another source. The mount-time sync should ONLY set if context is at default OR if opts.active was explicitly passed. Conservative behavior: only sync on first mount of useTools.)

- [ ] **Step 1: Failing tests.** Add tests covering:
  - `useTools({ active: 'rect' })` sets context's active to `'rect'` on mount.
  - `tools.setActive('text')` is reflected in `useActiveToolContext().active`.
  - `tools.engageHotkey('hand')` pushes to context.hotkeyStack.
  - `tools.disengageHotkey()` pops from context.hotkeyStack.
  - `tools.hotkeyEngaged` returns top of stack.
  - Without `<ActiveToolContextProvider>`, `useTools` throws.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/tools/useTools.test.ts`.

- [ ] **Step 3: Implement.** Replace the `useState` calls; reroute via context.

- [ ] **Step 4: Verify.** `npx vitest run src/tools` + `npx tsc --noEmit`. Existing tests should pass (the external API is preserved).

- [ ] **Step 5: Commit.**

```
git add src/tools/useTools.ts src/tools/useTools.test.ts
git commit -m "refactor(tools): useTools backed by ActiveToolContext (Phase 5)

State (active, hotkey stack) lives in the context; useTools is a thin
adapter exposing the existing ToolsApi shape. Hotkey moves from
single-engaged to stack model; hotkeyEngaged is derived as the top of
the stack for backwards compat."
```

---

### Task 2: `toolHoldAction` ongoing-action descriptor

**Files:**
- Create: `src/interactions/actions/defaults/toolHold.ts`
- Create: `src/interactions/actions/defaults/toolHold.test.ts`

Per the design above. One parametric ongoing-action descriptor that pushes/pops the active-tool stack based on `params.toolId`.

- [ ] **Step 1: Failing test:**

```ts
import { toolHoldAction } from './toolHold';

describe('toolHoldAction', () => {
  it('declares an ongoing-timing action requiring activeTool', () => {
    expect(toolHoldAction.id).toBe('tool.hold');
    expect(toolHoldAction.invoker.timing).toBe('ongoing');
    expect(toolHoldAction.requires).toEqual(['activeTool']);
  });

  it('start pushes the toolId to hotkey stack; onEnd pops it', () => {
    const pushSpy = vi.fn();
    const popSpy = vi.fn();
    const activeTool = {
      active: 'select', hotkeyStack: [],
      setActive: () => {}, pushHotkey: pushSpy, popHotkey: popSpy,
    };
    if (toolHoldAction.invoker.timing !== 'ongoing') throw new Error();
    const handle = toolHoldAction.invoker.start(
      { deps: { activeTool }, world: {x:0,y:0}, screen: {x:0,y:0}, modifiers: {alt:false,ctrl:false,meta:false,shift:false} } as any,
      { params: { toolId: 'hand' } },
    );
    expect(pushSpy).toHaveBeenCalledWith('hand');
    handle.onEnd?.({} as any, 'commit');
    expect(popSpy).toHaveBeenCalled();
  });

  it('no-op when params.toolId missing', () => {
    const pushSpy = vi.fn();
    const activeTool = { /* … */ pushHotkey: pushSpy, popHotkey: () => {} };
    if (toolHoldAction.invoker.timing !== 'ongoing') throw new Error();
    toolHoldAction.invoker.start({ deps: { activeTool } } as any, { params: {} });
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement** `toolHold.ts` per the design.

- [ ] **Step 3: Add to `defaults/index.ts`** — `export { toolHoldAction } from './toolHold';`

- [ ] **Step 4: Verify + commit.**

```
git add src/interactions/actions/defaults/toolHold.ts src/interactions/actions/defaults/toolHold.test.ts src/interactions/actions/defaults/index.ts
git commit -m "feat(registry): add toolHoldAction — ongoing-action descriptor for hotkey-engaged tools"
```

---

### Task 3: Rewire `useKeybindings` to register `toolHoldAction` bindings

**Files:**
- Modify: `src/tools/useKeybindings.ts`
- Modify: `src/tools/useKeybindings.test.ts`

Today `useKeybindings` has special code paths for tool-hotkey engagement (the `HOTKEY_TRIGGER_MAP` for ' ', Alt, Control, Meta, Shift; keydown→engageHotkey; keyup→disengageHotkey).

After Phase 5: those code paths are deleted. Instead, `useKeybindings` walks tools with `hotkey` declarations and registers a `toolHoldAction` binding per tool:

```ts
// For each tool in the registry that has `hotkey: 'space'` (or similar):
//   - Build a GestureBinding with:
//     spec: { kind: 'key-held', key: HOTKEY_KEY[tool.hotkey] },
//     actionId: 'tool.hold',
//     opts: { params: { toolId: tool.id } }
//   - Register it as an ambient binding via the actions registry.
```

The dispatcher (Phase 3) then handles keydown→start (which pushes the stack) and keyup→end (which pops). No special engageHotkey/disengageHotkey code paths in useKeybindings.

Tool-activation keybindings (V/R/T/P/...) stay in useKeybindings for Phase 5 — they're keystroke triggers to `setActive`, not ongoing actions. Phase 8+ may migrate them to `toolActivateAction` descriptors. For now, keep the existing setActive-call pattern.

- [ ] **Step 1: Failing tests.** Verify:
  - When a tool with `hotkey: 'space'` is registered, an ambient binding for `tool.hold` with `params.toolId: <id>` is in scope.
  - Space keydown engages the tool (top of hotkeyStack).
  - Space keyup disengages (stack popped).
  - The old `HOTKEY_TRIGGER_MAP` / engageHotkey codepath is gone.

- [ ] **Step 2: Implement** the rewire. Delete `HOTKEY_TRIGGER_MAP` and the keydown/keyup engage logic. Register `toolHoldAction` bindings instead.

The mechanics of "register an ambient binding" depend on how the actions registry handles ambient bindings. Phase 3's dispatcher derives ambient bindings by walking the actions registry for actions with `gestureBinding` set. So registering a single `toolHoldAction` descriptor with multiple per-tool bindings means: the descriptor's `gestureBinding` field becomes an array of per-tool entries. But that requires knowing all tools at descriptor-definition time — which we don't.

Two paths:
- (a) `useKeybindings` mutates the `toolHoldAction`'s `gestureBinding` array at runtime to add per-tool entries. The actions registry sees the updated list. (Mutation feels gross; verify the registry handles re-registration cleanly.)
- (b) `useKeybindings` registers a SEPARATE Action per tool (e.g. `tool.hold.hand`, `tool.hold.eyedropper`) — each is a thin wrapper around `toolHoldAction`'s logic with a closed-over `toolId`.

(b) is cleaner. Each tool with a hotkey gets its own action id; the descriptor pattern is preserved without runtime mutation.

```ts
// In useKeybindings, on mount, for each tool with `hotkey`:
const action: Action<readonly ['activeTool']> = {
  id: `tool.hold.${tool.id}`,
  label: `Hold for ${tool.label ?? tool.id}`,
  gestureBinding: { kind: 'key-held', key: HOTKEY_KEY[tool.hotkey] },
  requires: ['activeTool'],
  invoker: {
    timing: 'ongoing',
    start: (ctx) => {
      const activeTool = ctx.deps.activeTool;
      activeTool?.pushHotkey(tool.id);
      return { onEnd: () => activeTool?.popHotkey() };
    },
  },
};
registry.register(action);
```

This is cleaner than (a). Use it. The `toolHoldAction` from Task 2 becomes more of a reference/template than something directly registered.

ACTUALLY revisit Task 2: maybe the parametric form isn't needed. If each tool gets its own `tool.hold.<id>` action with closed-over toolId, no params are needed. Task 2 can just ship the per-tool action factory. Update Task 2 to define `makeToolHoldAction(toolId, key)` instead of a parametric `toolHoldAction`.

- [ ] **Step 3: Verify + commit.**

```
git add src/tools/useKeybindings.ts src/tools/useKeybindings.test.ts
git commit -m "refactor(tools): replace hotkey-engagement keydown special-case with per-tool tool.hold actions"
```

---

### Task 4: Audit `src/tools/dispatcher.ts` for slot-mechanic collapse

**Files:**
- Modify: `src/tools/dispatcher.ts` (selectively — only the active/hotkey slot reads)
- Possibly modify: `src/tools/dispatcher.test.ts`

The old `dispatcher.ts` has slot machinery: it knows about `active`, `hotkey`, `ambient` slots and dispatches per-slot. Phase 5's intent: this machinery is no longer the authoritative read. Active+hotkey come from `ActiveToolContext`; ambient comes from the actions registry.

For Phase 5, MINIMIZE changes. The old dispatcher continues to function for legacy tool dispatch (pointer events to tools' `pointer`/`drag`/`keyboard` handlers). What changes:
- Where the dispatcher reads `hotkey` slot's currently-engaged tool, it reads from `useTools` (which reads from context).
- That's already the case if `useTools` is the consumer of `dispatcher.ts`. Verify.

Likely outcome: NO code change in `dispatcher.ts`. The state flow already routes through `useTools` → `dispatcher`. Phase 5's change makes `useTools` get its state from the context — `dispatcher` sees the same shape.

- [ ] **Step 1: Audit.** Read `dispatcher.ts`; trace where active/hotkey state is read. If it reads from internal state (not from `useTools`), refactor to read from `useTools`'s exposed values.

- [ ] **Step 2: Run dispatcher tests** to confirm no regressions. If any test fails because it directly poked dispatcher's internal state expecting single-hotkey-engaged semantics, update the test to use the new stack model (or assert behavior at a higher level).

- [ ] **Step 3: Commit if any changes.**

```
git add src/tools/dispatcher.ts src/tools/dispatcher.test.ts
git commit -m "refactor(tools): dispatcher reads active/hotkey from ActiveToolContext via useTools"
```

(Optional — if no changes needed, skip this commit.)

---

### Task 5: Verify ambient-binding derivation includes `tool.hold.<id>` actions

**Files:** none modified; verification only.

The Phase 3 dispatcher walks the actions registry for ambient bindings. Per-tool `tool.hold.<id>` actions registered in Task 3 should automatically appear as ambient bindings (each has `gestureBinding`).

- [ ] **Step 1:** Write or update a test in `src/interactions/dispatcher/dispatcher.test.ts` (or `useGestureDispatcher.test.tsx`) that confirms: register `tool.hold.hand` via the actions registry → press Space (keydown) → dispatcher fires the action → `activeTool.pushHotkey('hand')` called → keyup → popHotkey called.

This is the integration test for the new system end-to-end.

- [ ] **Step 2: Commit the test.**

```
git add src/interactions/dispatcher/useGestureDispatcher.test.tsx
git commit -m "test(dispatcher): tool.hold ambient binding fires via dispatcher (Phase 5 integration)"
```

---

### Task 6: End-to-end verification + TODO note

**Files:** none modified; verification only.

- [ ] **Step 1: prepublishOnly** — green.
- [ ] **Step 2: build:demo** — green.
- [ ] **Step 3: Smoke-test** — spin up dev briefly: V/R/T/P tool-activation keystrokes still work; Space-hold-for-hand still works; tool-switch cancellation works (active tool change cancels in-flight hotkey).
- [ ] **Step 4: Update `docs/TODO.md`** Phase status block — add:

```
- Phase 5 (ActiveToolContext migration): shipped — useTools backed by the context (state lives there; external API preserved); hotkey moved from single-engaged to stack model; tool-hold-to-engage rewritten as per-tool ongoing-action descriptors registered with the actions registry; old hotkey-engagement keydown special-case removed.
```

- [ ] **Step 5: Commit.**

```
git add docs/TODO.md
git commit -m "docs(todo): note Phase 5 of registry unification shipped"
```

## Done criteria for Phase 5

- `useTools` is backed by `ActiveToolContext`; external `ToolsApi` shape unchanged.
- `hotkeyStack` is the canonical store; `hotkeyEngaged` derived as top of stack.
- Per-tool `tool.hold.<id>` actions registered for each tool with a `hotkey` declaration.
- Old hotkey-engagement keydown/keyup code in `useKeybindings` deleted.
- `npm run prepublishOnly` + `npm run build:demo` green.
- Existing tool-switch + hotkey behavior preserved (V/R/T/P, Space-for-hand).
- Hotkey-stack cancellation hook ready for Phase 7's tool-switch-cancels-gesture wiring (per Q2).

## Risks / open items

- **`useTools` initial-sync semantics.** When `useTools({ active: 'rect' })` mounts, the context might already be at `'select'` (default) or some other value (set by a sibling). Decide: opt.active wins (latest call), context wins (preserve user's tool choice across re-mounts), or first-mount wins. Default to **first-mount wins** — first `useTools` to mount sets the context; subsequent re-mounts respect the current context value. Document in JSDoc.

- **Multi-canvas implications.** Two `<SceneCanvas>` instances each have their own `<ActiveToolContextProvider>` (Phase 3 auto-mount); each has independent active tool. Good. Just noting it works correctly.

- **Tool-switch cancels in-flight gestures (Q2).** Phase 5 doesn't wire this; Phase 6 does (when `move` becomes the first ongoing action). The hook: `useEffect(() => { dispatcher.cancelAll('cancel') }, [activeToolCtx.active])`. Add when needed.

- **`tool.hold.<id>` action IDs vs activation IDs.** Phase 5 ships `tool.hold.<id>` for the hold pattern. Phase 8+ will ship `tool.activate.<id>` for the click/keystroke-to-switch pattern. The naming is consistent; no collision.

## What's next

Phase 6 — port `move` end-to-end. The first ongoing action goes through the dispatcher; `useSelectTool`'s move binding becomes a `GestureBinding` with `kind: 'drag'` + appropriate target. Validates that the dispatcher's drag pump (Phase 3's pointer-event flow) works for a real consumer. Will be its own plan (drafted alongside Phase 5 execution per lookahead-one).
