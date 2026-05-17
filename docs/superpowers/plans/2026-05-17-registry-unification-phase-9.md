# Registry unification — Phase 9: Swill ColorContext restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure Swillustrator's `useColorContextTool` from a "tool" (with keyDown handlers + an API surface) into a plain `<ColorContextProvider>` + three immediate-action descriptors (`color.reset`, `color.swap`, `color.toggleFocusedNone`) registered via the actions registry.

**Architecture:** The "tool" model conflated three concerns: (1) state holder, (2) keybinding registration, (3) API surface for downstream components. After Phase 9:
1. State → React Context (`<ColorContextProvider>`) — mutable via setters.
2. Keybindings → Action descriptors registered with the kit's actions registry; bindings flow through the dispatcher.
3. API → context consumers via `useColorContext()`.

The Swill-side `DepSchema` augments with `color: ColorContextValue` so the action descriptors can read/write color state via the dep registry pattern (Phase 4 T1 established this for kit-internal deps).

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–8. All changes in `apps/swillustrator/`.

---

## File map

**Create:**
- `apps/swillustrator/src/tools/colorContext/ColorContextProvider.tsx` (extracted from existing tool)
- `apps/swillustrator/src/tools/colorContext/depSchemaAugmentation.ts` (declares `color: ColorContextValue` in DepSchema)
- `apps/swillustrator/src/tools/colorContext/actions.ts` — three descriptors: `colorResetAction`, `colorSwapAction`, `colorToggleFocusedNoneAction`.
- Tests for each.

**Modify:**
- `apps/swillustrator/src/App.tsx` — use `<ColorContextProvider>` instead of the tool; register the actions via the registry.
- All consumers of the old tool (property panel, eyedropper, etc.) — switch from `useColorContextTool` to `useColorContext` (the new context hook).

**Delete:**
- `apps/swillustrator/src/tools/colorContext/useColorContextTool.ts` — replaced by provider+actions.
- `apps/swillustrator/src/tools/colorContext/useColorContextTool.test.ts` — replaced by provider+action tests.

## Tasks

### Task 1: Extract `<ColorContextProvider>` + `useColorContext` hook

Move the state-holding parts of `useColorContextTool` into a React Context. The provider holds the fill/stroke/focus state; the hook exposes it.

### Task 2: Declare `color: ColorContextValue` in DepSchema via declaration merging

Following Phase 4 T1's pattern. Action descriptors that need color access declare `requires: ['color']`.

### Task 3: Define the three action descriptors

```ts
export const colorResetAction: Action = {
  id: 'color.reset',
  label: 'Reset colors',
  defaultBinding: { key: 'd' },
  gestureBinding: { kind: 'key', key: 'd' },
  requires: ['color'] as const,
  invoker: { timing: 'immediate', run: ({ color }) => color.reset() },
};

export const colorSwapAction: Action = {
  id: 'color.swap',
  label: 'Swap fill/stroke',
  defaultBinding: { key: 'x' },
  gestureBinding: [
    { spec: { kind: 'key', key: 'x' }, opts: { params: { kind: 'swap' } } },
    { spec: { kind: 'key', key: 'x', mods: { shift: true } }, opts: { params: { kind: 'swapFocus' } } },
  ],
  requires: ['color'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ color }, params) => {
      if (params?.kind === 'swapFocus') color.swapFocus();
      else color.swap();
    },
  },
};

export const colorToggleFocusedNoneAction: Action = {
  id: 'color.toggleFocusedNone',
  label: 'Toggle focused color none',
  defaultBinding: { key: '/' },
  gestureBinding: { kind: 'key', key: '/' },
  requires: ['color'] as const,
  invoker: { timing: 'immediate', run: ({ color }) => color.toggleFocusedNone() },
};
```

### Task 4: Wire deps in App.tsx

Inside `<ColorContextProvider>`, register the color context as a dep source:

```tsx
function ColorDepBridge() {
  const color = useColorContext();
  useDepSource('color', () => color);
  return null;
}
```

Add the three action descriptors to the actions registry (via `useStandardActions`'s options or a direct registration).

### Task 5: Update consumers

Find every reference to `useColorContextTool` in Swill; replace with `useColorContext`. The new hook returns the same shape as the old tool's `api` field.

### Task 6: Delete the old tool

```
rm apps/swillustrator/src/tools/colorContext/useColorContextTool.ts
rm apps/swillustrator/src/tools/colorContext/useColorContextTool.test.ts
```

### Task 7: Verify

Swill's tests pass; the app's color-context-related behavior works (manual smoke or integration test).

### Task 8: TODO + commit

Update TODO; commit; done.

## Risks

- **Hot path for keybinding latency.** ColorContext keybindings should still feel snappy. Verify via manual test.
- **Eyedropper integration.** The eyedropper tool reads color context to apply colors. Verify it still works after the restructure (might need to use `useColorContext` instead of the old tool API).
- **Action registration timing.** The actions need to be registered AFTER the dep source is available. The `ColorDepBridge` component pattern (above) ensures this naturally.
