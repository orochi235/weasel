# @weasel-js/modes

App-level modality primitives: capability tags, mode definitions, mode registry, and decoration layer.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/modes).

## Install

```sh
npm install @weasel-js/modes
```

## Usage

A mode registry holds the app's modes and which one is active. Hand it to a canvas, which then gates
tools and chrome on the active mode's capabilities and binds each mode's entry and exit keys:

```tsx
import { createModeRegistry } from '@weasel-js/modes';
import { DEFAULT_MODES } from '@weasel-js/modes/presets/default';

const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: 'normal' });

<SceneCanvas scene={scene} features={['draw']} modes={modes} />;

modes.setMode('path-edit');
modes.subscribe(() => console.log(modes.current().label));
```

`DEFAULT_MODES` is normal, path edit, free transform, text edit and crop. A mode of your own is a
`ModeDefinition`: `kind` (`'soft'`, where each edit undoes on its own, or `'strict'`, which commits or
cancels as one step), the capability tags it `allows`, and whether it dims what is out of scope.

## License

MIT
