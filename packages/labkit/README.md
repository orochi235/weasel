# @labkit/react

React widgets for building self-contained interactive **lab** pages — pages with sliders, controls, and canvas-based experimentation.

This is the v0.x of the library. The Lab/Workspace/Instrument runtime arrives in later plans; v0.0.1 ships presentational primitives.

## Installation

```bash
npm install @labkit/react
```

## Usage

```tsx
import { LabShell, Toolbar, WorkspaceGrid, FpsMeter } from '@labkit/react';
import '@labkit/react/styles.css';

function MyLab() {
  return (
    <LabShell title="My Lab" header={<button>+ Add</button>}>
      <WorkspaceGrid>
        <div>Workspace 1</div>
        <div>Workspace 2</div>
      </WorkspaceGrid>
    </LabShell>
  );
}
```

## Theme

Theme follows the OS by default. To force a theme:

```tsx
<LabShell title="..." theme="dark">...</LabShell>
```

## Development

```bash
npm install
npm run dev          # Vite dev server (examples/)
npm run storybook    # Storybook on :6006
npm test             # Vitest
npm run lint         # Biome + class-prefix check
npm run build        # Build dist/ for publish
```

## Documentation

- [`docs/AGENTS.md`](./docs/AGENTS.md) — agent navigation guide
- [`docs/RECIPES.md`](./docs/RECIPES.md) — composition patterns
- [`docs/superpowers/specs/2026-04-26-labkit-design.md`](./docs/superpowers/specs/2026-04-26-labkit-design.md) — design spec
