# @weasel-js/select

Selection as a value: which ids a press selects, under toggle, range and anchor rules a surface
configures. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/select).

## Install

```sh
npm install @weasel-js/select
```

## Usage

```ts
import { intentOf, select } from '@weasel-js/select';

// A list's convention: Cmd/Ctrl toggles a row, shift ranges from the anchor.
const policy = { mode: 'multi', toggle: ['meta', 'ctrl'], range: 'shift' } as const;

let state = { ids: ['b'], anchor: 'b' };
state = select(state, 'd', intentOf({ shift: true, meta: false, ctrl: false }, policy), {
  order: ['a', 'b', 'c', 'd'],          // what a range walks
  forceSingle: (id) => id === 'c',      // a locked row is selected only alone
});
// → { ids: ['b', 'd'], anchor: 'b' }
```

| intent | ids | anchor |
|---|---|---|
| `replace` | `[id]` | `id` |
| `single` | `[id]`; every intent resolves to it on an id `forceSingle` holds | `id` |
| `toggle` | the selected ids `forceSingle` does not hold, with `id` added or removed | `id` |
| `range` | ids from anchor to `id` in `order`, skipping those `forceSingle` holds; `[id]` if there is no anchor or either end is outside `order` | unchanged |

`createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract that
`@weasel-js/core`'s `Scene` also satisfies.

## License

MIT
