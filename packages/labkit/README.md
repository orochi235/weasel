# @weasel-js/labkit

React widgets for building self-contained interactive **lab** pages — pages with sliders, controls, and canvas-based experimentation.

This is the v0.x of the library. The Lab/Trial/Instrument runtime arrives in later plans; v0.0.1 ships presentational primitives.

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
  "@weasel-js/labkit": "file:../labkit"
}
```

## Usage

```tsx
import { LabShell, Toolbar, Workspace, FpsMeter } from '@weasel-js/labkit';
import '@weasel-js/labkit/styles.css';

function MyLab() {
  return (
    <LabShell title="My Lab" header={<button>+ Add</button>}>
      <Workspace>
        <div>Trial 1</div>
        <div>Trial 2</div>
      </Workspace>
    </LabShell>
  );
}
```

## Theming

labkit ships one theme, `interstellar` — a cosmic dark and a warm parchment
light — as a value, not a stylesheet:

```tsx
import { interstellarTheme } from '@weasel-js/labkit';
import { ThemeProvider } from '@weasel-js/theme/react';

<ThemeProvider theme={interstellarTheme} mode="dark">…</ThemeProvider>
```

`<Lab>` and `<LabShell>` do this for you; `mode` is `"auto"` (follow the OS),
`"light"` or `"dark"`. Only `styles.css` needs importing — the token values
arrive through the provider.

## Driving your own renderer

`CanvasStack` is 2D. For three.js or raw WebGL, take rects and dirtiness from
labkit and keep the GL yourself:

```tsx
import { toDeviceRect, useSurfaceTile, useTiledSurface } from '@weasel-js/labkit/surface';
```

A trial's `view` is opaque to labkit — it is persisted, restored on Reset and
handed to the instrument without being read into — so a 3D lab stores an orbit
there and gets all three. `useOrbit` is the 3D peer of `usePanZoom`.

See `src/surface/AGENTS.md` for the contract and the traps.

## Long-running work

An instrument with work too slow for a render declares a `job`. labkit starts it,
aborts it on unmount and on a key change, discards results from a superseded run,
and renders progress and a cancel control into the trial chrome. Per-item failure
is an event rather than a thrown error, so a run with two failed items is a
partial success.

```tsx
import type { JobCapability } from '@weasel-js/labkit/job';
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
