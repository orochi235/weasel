# Labkit — Agent Guide

A map of the library so agents can find what they need quickly.

## Where to find things (Plan 1)

| Concept | Source |
|---|---|
| `<LabShell>` | `src/lab/LabShell.tsx` |
| `<WorkspaceGrid>` | `src/lab/WorkspaceGrid.tsx` |
| `gridDims()` | `src/lab/gridDims.ts` |
| `<Toolbar>` + subcomponents | `src/primitives/Toolbar.tsx` |
| `<Sidebar>` | `src/primitives/Sidebar.tsx` |
| `<StatusBar>` | `src/primitives/StatusBar.tsx` |
| `<FpsMeter>` | `src/primitives/FpsMeter.tsx` |
| `<ScaleIndicator>` | `src/primitives/ScaleIndicator.tsx` |
| Theme tokens | `src/theme/tokens.less` |
| Theme overrides | `src/theme/light.less`, `src/theme/dark.less` |
| Class-prefix enforcement | `scripts/check-class-prefix.ts` |

## When to use what

- Composing a one-off lab page? Import primitives directly from `@labkit/react`.
- Need full Lab/Workspace runtime? Coming in later plans (Lab, Workspace, defineInstrument).

## Conventions

- All DOM classes start with `lk-` (enforced by `scripts/check-class-prefix.ts`)
- Component CSS lives in a sibling `.less` file (e.g., `Toolbar.less` next to `Toolbar.tsx`)
- Each primitive ships with a `.test.tsx` and a `.stories.tsx`
- Theme tokens are CSS custom properties (`--lk-*`); use them in component CSS, never hardcode colors

## Forking a primitive

If a primitive doesn't fit your needs, copy its source into your project. Each component is self-contained — TSX + LESS, no cross-imports beyond theme tokens.

## See also

- `docs/RECIPES.md` — composition patterns
- `docs/superpowers/specs/2026-04-26-labkit-design.md` — full design spec
