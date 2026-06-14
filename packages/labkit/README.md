# @lab-kit/react

React widgets for building self-contained interactive **lab** pages — pages with sliders, controls, and canvas-based experimentation.

This is the v0.x of the library. The Lab/Workspace/Instrument runtime arrives in later plans; v0.0.1 ships presentational primitives.

## Installation

Not published to npm — for now the package is intentionally local-install-only.
It also depends on a sibling clone of [weasel](https://github.com/orochi235/weasel),
so clone both side by side:

```bash
git clone https://github.com/orochi235/weasel.git
git clone https://github.com/orochi235/labkit.git
cd weasel && npm install && npm run build
cd ../labkit && npm install && npm run build
```

Then point your app at the local clone:

```json
"dependencies": {
  "@lab-kit/react": "file:../labkit"
}
```

## Usage

```tsx
import { LabShell, Toolbar, WorkspaceGrid, FpsMeter } from '@lab-kit/react';
import '@lab-kit/react/styles.css';

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

- [Docs site](https://orochi235.github.io/labkit/)
- [Recipes](https://orochi235.github.io/labkit/RECIPES) — composition patterns
- [Agent guide](https://orochi235.github.io/labkit/AGENTS) — agent navigation guide
- [Storybook](https://orochi235.github.io/labkit/storybook/)
- [Speech balloon experiment](https://orochi235.github.io/labkit/storybook/?path=/story/ui-properties-propertypanel-speechballoonpanels--right-sidebar-tails) — sample implementation built on the property-panel widgets
- [Design spec](https://github.com/orochi235/labkit/blob/main/docs/superpowers/specs/2026-04-26-labkit-design.md)
