# @weasel-js/ui-canvas

The `@weasel-js/ui` components bound to a weasel canvas: `SelectionPanel`, the inspector over a scene's selected
nodes, with its `AnchorFields` and `CharacterOptions`; `useSceneLayerList`, which drives ui's `LayerList` from a
scene; `SceneGradientHandles`, a gradient's handles over a scene node; `Rulers`; `PlotDataPanel`, the data editor for
a `@weasel-js/plot` chart; and `kitIcons`, every kit package's icon table at once.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/ui-canvas).

## Install

```sh
npm install @weasel-js/ui-canvas @weasel-js/ui @weasel-js/core @weasel-js/editing
```

## Usage

```tsx
import '@weasel-js/theme/tokens.css';
import '@weasel-js/ui/style.css';
import '@weasel-js/ui-canvas/style.css';
import { IconRegistryProvider } from '@weasel-js/icons/react';
import { SelectionPanel } from '@weasel-js/ui-canvas/components/inspector/SelectionPanel';
import { kitIcons } from '@weasel-js/ui-canvas/kit-icons';

<IconRegistryProvider icons={kitIcons}>
  <SelectionPanel scene={scene} selection={selection} features={features} />
</IconRegistryProvider>
```

`SelectionPanel` draws through ui's panel engine, `@weasel-js/ui/components/PanelCells`, which renders a panel of prefs
sections over any records; this package supplies scene nodes as those records.

## License

MIT
